import "server-only";
import { listBots, updateBot, type Bot } from "./settings";
import { loadSectorLedger } from "./parsers/sectorLedger";
import { sendDiscord } from "./discord";
import { subscribe, type MemoryBatch } from "./watch";

/** Audit F7 — auto-disables a bot after N consecutive losing closed trades.
 *
 *  Trigger: any TRADE-LOG.md or SECTOR-LEDGER.md write the watcher reports
 *  for a bot with `sentinel.enabled = true`. We evaluate the bot's last N
 *  closed trades; if they're all losses (outcome === "L"), we flip
 *  `enabled = false` via updateBot and fire a Discord `alert` notification
 *  to the bot's per-bot webhook (or the global one as fallback).
 *
 *  Idempotent: a bot that's already disabled is skipped (the toggle has
 *  already done its job; a second flip is a no-op). A re-enabled bot
 *  starts fresh — the cap looks at the most recent N trades regardless. */

const RELEVANT_FILES = new Set(["TRADE-LOG.md", "SECTOR-LEDGER.md"]);

export type SentinelTripReason = "consecutive-losses" | "healthcheck-failure";

export type SentinelTrip = {
  botId: string;
  cap: number;
  losingSymbols: string[];
  reason: SentinelTripReason;
  /** Free-form detail. For healthcheck-failure trips, this is the error
   *  string from the failed Alpaca probe. Empty for consecutive-losses. */
  detail?: string;
};

const TRIP_HISTORY_CAP = 20;

/** Persists a trip into the bot's `sentinelTrips` array (capped to the
 *  last N entries) and disables the bot. Used by both the consecutive-
 *  losses path (`evaluateBotInternal`) and the healthcheck-failure path
 *  (audit follow-up #2 — credentials-revoked auto-disable). */
export async function recordSentinelTrip(
  bot: Bot,
  trip: SentinelTrip
): Promise<void> {
  const priorTrips = bot.sentinelTrips ?? [];
  const nextTrips = [
    ...priorTrips,
    {
      trippedAt: new Date().toISOString(),
      cap: trip.cap,
      symbols: trip.losingSymbols,
      reason: trip.reason,
      detail: trip.detail,
    },
  ].slice(-TRIP_HISTORY_CAP);
  await updateBot(bot.id, { enabled: false, sentinelTrips: nextTrips });
  await notifyTripped(trip);
}

/** Internal core — evaluates the sentinel for a bot record we already have
 *  in hand. Notification is paired with the disable so any caller that
 *  trips a bot can never accidentally do so silently. */
async function evaluateBotInternal(bot: Bot): Promise<SentinelTrip | null> {
  if (!bot.enabled) return null;
  if (!bot.sentinel?.enabled) return null;
  const cap = bot.sentinel.consecutiveLossesCap;

  const ledger = await loadSectorLedger({
    bot: bot.id,
    strategy: bot.strategySlug,
  });
  // Take the last `cap` closed trades in chronological order. loadSectorLedger
  // already sorts by date ascending, so slice from the end.
  const recent = ledger.closed.slice(-cap);
  if (recent.length < cap) return null;
  if (!recent.every((t) => t.outcome === "L")) return null;

  const trip: SentinelTrip = {
    botId: bot.id,
    cap,
    losingSymbols: recent.map((t) => t.symbol),
    reason: "consecutive-losses",
  };
  await recordSentinelTrip(bot, trip);
  return trip;
}

/** Public single-bot evaluator — looks up the bot from settings. Used by
 *  ad-hoc API endpoints / future direct callers. Performs the same
 *  disable+notify pairing as the walker. */
export async function evaluateBotSentinel(
  botId: string
): Promise<SentinelTrip | null> {
  const bots = await listBots();
  const bot = bots.find((b) => b.id === botId);
  if (!bot) return null;
  return evaluateBotInternal(bot);
}

async function notifyTripped(trip: SentinelTrip): Promise<void> {
  const lines: string[] = [];
  if (trip.reason === "healthcheck-failure") {
    lines.push(`🛑 Sentinel tripped — bot \`${trip.botId}\` auto-disabled.`);
    lines.push(
      `Alpaca healthcheck failed ${trip.cap} times in a row. The bound account credentials are likely revoked or rotated.`
    );
    if (trip.detail) lines.push(`Last error: ${trip.detail}`);
    lines.push(`Fix the credentials in /bots, then re-enable.`);
  } else {
    lines.push(`🛑 Sentinel tripped — bot \`${trip.botId}\` auto-disabled.`);
    lines.push(
      `Last ${trip.cap} closed trades all lost: ${trip.losingSymbols.join(", ")}.`
    );
    lines.push(`Re-enable from /bots once the situation is reviewed.`);
  }
  try {
    await sendDiscord("alert", lines.join("\n"), { botId: trip.botId });
  } catch {
    // Notification failure must not block the disable — the user will see
    // the disabled state in the dashboard regardless.
  }
}

/** Walks every bot with sentinel enabled. Used by the watcher fan-out and
 *  manually by an admin endpoint if we add one. Returns the bots that
 *  tripped this pass for caller logging. Single `listBots()` call shared
 *  across the loop (audit P2). */
export async function evaluateAllSentinels(): Promise<SentinelTrip[]> {
  const bots = await listBots();
  const trips: SentinelTrip[] = [];
  for (const b of bots) {
    if (!b.enabled || !b.sentinel?.enabled) continue;
    const trip = await evaluateBotInternal(b);
    if (trip) trips.push(trip);
  }
  return trips;
}

declare global {
  // eslint-disable-next-line no-var
  var __sentinelWatcherWired: boolean | undefined;
}

/** Idempotent: subscribes once per server process. Called from the
 *  /api/bots/sentinel/check route on first hit and from any module that
 *  needs the watcher live (we call it from strategyState since that's
 *  hit on every dashboard tab). */
export function ensureSentinelWatcher(): void {
  if (globalThis.__sentinelWatcherWired) return;
  globalThis.__sentinelWatcherWired = true;
  subscribe(async (batch: MemoryBatch) => {
    const touchedBotIds = new Set<string>();
    for (const ev of batch.events) {
      if (!ev.bot || ev.bot === "shared") continue;
      if (!RELEVANT_FILES.has(ev.file)) continue;
      touchedBotIds.add(ev.bot);
    }
    if (touchedBotIds.size === 0) return;

    // Audit P1+P2: load the bot list ONCE, filter to the intersection of
    // (touched ∧ sentinel-armed) BEFORE entering the loop. Avoids a
    // settings-disk-read per-touched-bot and skips work for bots whose
    // sentinel is disabled.
    const bots = await listBots().catch(() => []);
    const armed = bots.filter(
      (b) => b.enabled && b.sentinel?.enabled && touchedBotIds.has(b.id)
    );
    for (const bot of armed) {
      await evaluateBotInternal(bot).catch(() => null);
    }
  });
}
