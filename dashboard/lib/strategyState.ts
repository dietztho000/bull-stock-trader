import "server-only";
import { loadSectorLedger, type SectorStreak } from "./parsers/sectorLedger";
import { loadEarningsCalendar } from "./parsers/earningsCalendar";
import { loadResearchLog } from "./parsers/researchLog";
import { loadSectorMap } from "./parsers/sectorMap";
import { loadBenchmark } from "./parsers/benchmark";
import { cooldownStatus } from "./stats/cooldown";
import { runAlpaca } from "./alpaca";
import { readBotMode } from "./mode";
import { daysUntilEarnings } from "./parsers/earningsCalendar.shared";
import { todayInCT, currentWeekMondayCT } from "./time";
import { loadSettings } from "./settings";
import { isAlpacaError, type AlpacaPosition } from "./types/alpaca";
import type { MemoryCtx } from "./memoryPath";
import type { BotId } from "./alpacaMode";
import { subscribe, type MemoryBatch } from "./watch";

// ─── Server-side cache (audit A3 + P1) ──────────────────────────────────
// loadStrategyState fans out to 3 file reads + 1 Alpaca shell-out, and is
// hit by N tabs × M consumers (mascot, alert watcher, OrderEntryTile rule
// blocker, brief route). Without this, a single dashboard with 4 tabs
// open issues 12+ Alpaca positions calls per minute just for risk state.
//
// Cache key: botId. Value gets evicted on (a) TTL expiry, (b) any memory
// write the watcher classifies for that bot, (c) any shared-file write
// (SECTOR-MAP, ECONOMIC-CALENDAR — research-log lives per-bot so it's
// covered by (b)).
type CacheEntry = { state: StrategyState; expiresAt: number };
const TTL_MS = 25_000;
declare global {
  // eslint-disable-next-line no-var
  var __strategyStateCache: Map<string, CacheEntry> | undefined;
  // eslint-disable-next-line no-var
  var __strategyStateInflight: Map<string, Promise<StrategyState>> | undefined;
  // eslint-disable-next-line no-var
  var __strategyStateInvalidatorWired: boolean | undefined;
}
function cache(): Map<string, CacheEntry> {
  if (!globalThis.__strategyStateCache) {
    globalThis.__strategyStateCache = new Map();
  }
  return globalThis.__strategyStateCache;
}
function inflight(): Map<string, Promise<StrategyState>> {
  if (!globalThis.__strategyStateInflight) {
    globalThis.__strategyStateInflight = new Map();
  }
  return globalThis.__strategyStateInflight;
}
function wireInvalidator() {
  if (globalThis.__strategyStateInvalidatorWired) return;
  globalThis.__strategyStateInvalidatorWired = true;
  subscribe(invalidateForBatch);
}
function invalidateForBatch(batch: MemoryBatch) {
  const c = cache();
  for (const bot of batch.bots) {
    if (bot === "shared") {
      // Shared SECTOR-MAP / ECONOMIC-CALENDAR / MARKET-EARNINGS feed every
      // bot's state; nuke the entire cache. In-flight promises are left
      // alone — they'll resolve with current data and skip cache write.
      c.clear();
      return;
    }
    // Cache keys are `${botId}:${strategy}:${date}` — walk and prefix-match.
    const prefix = `${bot}:`;
    for (const key of c.keys()) {
      if (key.startsWith(prefix)) c.delete(key);
    }
  }
}

/** Snapshot of "what would block a new trade right now" + held-position risk
 *  that the dashboard surfaces. All math is derived from existing memory
 *  files + Alpaca positions — no new data sources.
 *
 *  Consumed by:
 *    - mascot mood selector (mascot adopts a worried/frustrated mood)
 *    - Discord brief (lists blocked ideas / cooldowns / breaker state)
 *    - rule-enforcement modal (Chunk 4)
 */
export type StrategyState = {
  date: string;
  /** GICS sectors at or over the open-position cap. */
  sectorsAtCap: string[];
  /** Sectors flagged BLOCKED in SECTOR-LEDGER (rule #10 / #17). */
  blockedSectors: string[];
  /** Tickers in re-entry cooldown (rule #20) right now. */
  cooldownSymbols: Array<{
    symbol: string;
    daysRemaining: number;
    lastLossDate: string;
  }>;
  /** Held positions whose earnings hit within `earningsGateDays`. */
  earningsT2Held: Array<{
    symbol: string;
    daysUntil: number;
    type: "BMO" | "AMC" | "";
  }>;
  /** Research ideas that would be blocked by sector cap or cooldown. */
  blockedIdeas: Array<{
    symbol: string;
    sector: string;
    reason: "sector-cap" | "cooldown" | "earnings-gate";
    detail: string;
  }>;
  /** Position slot saturation: 0–1. */
  slotsUsed: number;
  slotsCap: number;
  /** Day P&L breaker tripped — no new entries (rule #14). Undefined when
   *  benchmark data is missing (e.g. brand-new bot with no rows yet). */
  dayBreakerActive?: boolean;
  /** Week P&L breaker tripped (rule #14). */
  weekBreakerActive?: boolean;
  /** Day P&L percent vs. last close (signed). Used by alert watcher to
   *  build a stable signature; null when benchmark has no current row. */
  dayPnlPct?: number | null;
  /** Approximate week P&L percent (signed) — Monday open vs. latest. */
  weekPnlPct?: number | null;
};

const SYMBOL_RE = /\b([A-Z]{1,5})\b/;

function todayIso(): string {
  return todayInCT();
}

/** Cheapest path: read everything in parallel, then compute derived state.
 *  When `bot` matches a registered bot, the Alpaca call routes through the
 *  vault-resolved account; otherwise it falls back to the legacy `BOT_MODE`
 *  path so pre-migration installs keep working. Results are cached for 25s
 *  per botId and invalidated on memory writes via the chokidar watcher.
 *
 *  Concurrent calls for the same key share a single in-flight promise
 *  (audit P5) — without this, two simultaneous tabs both enter the load
 *  path and both hit the Alpaca API + read the same files. */
export async function loadStrategyState(opts?: { bot?: BotId; strategy?: string }): Promise<StrategyState> {
  wireInvalidator();
  const today = todayIso();
  const settings = await loadSettings();
  const botId: BotId = opts?.bot ?? (await readBotMode());
  const bot = settings.bots.find((b) => b.id === botId);
  const ctx: MemoryCtx = { bot: botId, strategy: opts?.strategy ?? bot?.strategySlug };
  // When the bot has no registry-bound account, fall back to the host's
  // legacy BOT_MODE — never silently default to live for any non-"paper"
  // bot id, which would route paper-bot risk state through the live account.
  const runOpts = bot
    ? { accountId: bot.accountId, botId }
    : { mode: await readBotMode() };

  // Cache key includes the date so the next morning's first call recomputes
  // (cooldownStatus / earningsT2 are date-relative).
  const cacheKey = `${botId}:${ctx.strategy ?? "default"}:${today}`;
  const now = Date.now();
  const hit = cache().get(cacheKey);
  if (hit && hit.expiresAt > now) {
    return hit.state;
  }

  // In-flight dedup: if another caller is already computing this key, ride
  // along on its promise instead of starting a parallel computation.
  const pending = inflight().get(cacheKey);
  if (pending) return pending;

  const work = computeStrategyState({
    cacheKey,
    today,
    ctx,
    runOpts,
    settings,
    startedAt: now,
  });
  inflight().set(cacheKey, work);
  try {
    return await work;
  } finally {
    inflight().delete(cacheKey);
  }
}

async function computeStrategyState(args: {
  cacheKey: string;
  today: string;
  ctx: MemoryCtx;
  runOpts: { accountId: string; botId: BotId } | { mode: "live" | "paper" };
  settings: Awaited<ReturnType<typeof loadSettings>>;
  startedAt: number;
}): Promise<StrategyState> {
  const { cacheKey, today, ctx, runOpts, settings, startedAt } = args;

  const [ledger, earningsMap, research, sectorMap, positionsRaw, benchmark] =
    await Promise.all([
      loadSectorLedger(ctx),
      loadEarningsCalendar(ctx).catch(() => new Map()),
      loadResearchLog(ctx),
      loadSectorMap(),
      runAlpaca("positions", [], runOpts)
        .then((d) => d as AlpacaPosition[] | { error: string })
        .catch(() => null),
      loadBenchmark(ctx).catch(() => null),
    ]);

  const positions: AlpacaPosition[] =
    positionsRaw && !isAlpacaError(positionsRaw)
      ? (positionsRaw as AlpacaPosition[])
      : [];

  const { strategy } = settings;

  // ─── Sector concentration ────────────────────────────────────────────
  const symbolsBySector = new Map<string, string[]>();
  for (const p of positions) {
    const sym = p.symbol.toUpperCase();
    const sector = sectorMap.get(sym) ?? "Unknown";
    if (!symbolsBySector.has(sector)) symbolsBySector.set(sector, []);
    symbolsBySector.get(sector)!.push(sym);
  }
  const sectorsAtCap: string[] = [];
  for (const [sector, syms] of symbolsBySector) {
    if (syms.length >= strategy.sectorCap) sectorsAtCap.push(sector);
  }

  const blockedSectors: string[] = ledger.streaks
    .filter((s: SectorStreak) => s.status === "BLOCKED")
    .map((s) => s.sector);

  // ─── Cooldowns (rule #20) ─────────────────────────────────────────────
  const symbolsSeen = new Set(ledger.closed.map((t) => t.symbol.toUpperCase()));
  const cooldownSymbols: StrategyState["cooldownSymbols"] = [];
  for (const sym of symbolsSeen) {
    const cd = cooldownStatus(sym, ledger.closed, today);
    if (cd.blocked && cd.lastLossDate && cd.daysRemaining != null) {
      cooldownSymbols.push({
        symbol: sym,
        daysRemaining: cd.daysRemaining,
        lastLossDate: cd.lastLossDate,
      });
    }
  }

  // ─── Earnings T-N for held positions ──────────────────────────────────
  const earningsT2Held: StrategyState["earningsT2Held"] = [];
  for (const p of positions) {
    const sym = p.symbol.toUpperCase();
    const entry = earningsMap.get(sym);
    if (!entry || !entry.date || /^none/i.test(entry.date)) continue;
    const days = daysUntilEarnings(entry.date);
    if (days == null || days < 0) continue;
    if (days <= strategy.earningsGateDays) {
      earningsT2Held.push({
        symbol: sym,
        daysUntil: days,
        type: entry.type ?? "",
      });
    }
  }
  earningsT2Held.sort((a, b) => a.daysUntil - b.daysUntil);

  // ─── Blocked research ideas ───────────────────────────────────────────
  const todayResearch = research.find((r) => r.date === today) ?? research[0];
  const blockedIdeas: StrategyState["blockedIdeas"] = [];
  if (todayResearch) {
    const heldSymbols = new Set(positions.map((p) => p.symbol.toUpperCase()));
    for (const idea of todayResearch.ideas) {
      const m = idea.match(SYMBOL_RE);
      const sym = m?.[1];
      if (!sym) continue;
      if (heldSymbols.has(sym)) continue; // already in
      const sector = sectorMap.get(sym) ?? "Unknown";
      const heldInSector = symbolsBySector.get(sector)?.length ?? 0;
      if (heldInSector >= strategy.sectorCap) {
        blockedIdeas.push({
          symbol: sym,
          sector,
          reason: "sector-cap",
          detail: `${heldInSector}/${strategy.sectorCap} in ${sector}`,
        });
        continue;
      }
      const cd = cooldownStatus(sym, ledger.closed, today);
      if (cd.blocked && cd.daysRemaining != null) {
        blockedIdeas.push({
          symbol: sym,
          sector,
          reason: "cooldown",
          detail: `cooldown ${cd.daysRemaining}d remaining since stop ${cd.lastLossDate}`,
        });
        continue;
      }
      const earn = earningsMap.get(sym);
      if (earn?.date) {
        const d = daysUntilEarnings(earn.date);
        if (d != null && d >= 0 && d <= strategy.earningsGateDays) {
          blockedIdeas.push({
            symbol: sym,
            sector,
            reason: "earnings-gate",
            detail: `EPS in ${d}d`,
          });
        }
      }
    }
  }

  // ─── Drawdown breakers (rule #14) ─────────────────────────────────────
  // Day P&L from BENCHMARK.md's most recent row vs the prior session.
  // Week P&L approximated as latest portfolio vs the row at-or-after the
  // current CT week's Monday. Both fall back to undefined when no benchmark
  // data exists (brand-new bot) so downstream consumers can render N/A.
  let dayPnlPct: number | null = null;
  let weekPnlPct: number | null = null;
  let dayBreakerActive: boolean | undefined;
  let weekBreakerActive: boolean | undefined;
  if (benchmark && benchmark.rows.length > 0) {
    const rows = benchmark.rows;
    const latest = rows[rows.length - 1];
    dayPnlPct = latest?.dayPct ?? null;
    if (dayPnlPct != null) {
      dayBreakerActive = dayPnlPct < strategy.dayBreakerPct;
    }
    if (latest?.portfolio != null) {
      const mondayIso = currentWeekMondayCT(new Date(latest.date + "T12:00:00Z"));
      const weekRow = rows.find((r) => r.date >= mondayIso);
      if (weekRow?.portfolio && weekRow.portfolio > 0) {
        weekPnlPct =
          ((latest.portfolio - weekRow.portfolio) / weekRow.portfolio) * 100;
        weekBreakerActive = weekPnlPct < strategy.weekBreakerPct;
      }
    }
  }

  const state: StrategyState = {
    date: today,
    sectorsAtCap,
    blockedSectors,
    cooldownSymbols,
    earningsT2Held,
    blockedIdeas,
    slotsUsed: positions.length,
    slotsCap: strategy.maxOpenPositions,
    dayBreakerActive,
    weekBreakerActive,
    dayPnlPct,
    weekPnlPct,
  };
  cache().set(cacheKey, { state, expiresAt: startedAt + TTL_MS });
  return state;
}
