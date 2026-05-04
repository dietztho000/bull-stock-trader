import { NextResponse } from "next/server";
import { runAlpaca } from "@/lib/alpaca";
import { listBots } from "@/lib/settings";
import { recordSentinelTrip } from "@/lib/sentinel";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Audit F1 — connectivity probe for a bot's bound Alpaca account.
 *
 *  Hits `runAlpaca("account")` against the bot's vault-resolved credentials
 *  and reports ok/error + latency. Used by BotCard's status dot to surface
 *  revoked-or-rotated keys before the user notices a stale equity tile.
 *
 *  Auto-disable on persistent failure (follow-up #2 — paired with C4):
 *  after `HEALTHCHECK_TRIP_THRESHOLD` consecutive failures we record a
 *  sentinel trip with reason="healthcheck-failure" and disable the bot.
 *  Counter is process-local — a restart resets it, which is desirable
 *  (a transient outage shouldn't survive across restarts as a partial
 *  count). Counter resets on the first successful probe.
 *
 *  Cheap (single GET to /v2/account); intended for ~60s refresh cadences. */

const HEALTHCHECK_TRIP_THRESHOLD = 3;

declare global {
  // eslint-disable-next-line no-var
  var __healthcheckFailureCounts: Map<string, number> | undefined;
}
function failureCounts(): Map<string, number> {
  if (!globalThis.__healthcheckFailureCounts) {
    globalThis.__healthcheckFailureCounts = new Map();
  }
  return globalThis.__healthcheckFailureCounts;
}

type HealthOk = {
  ok: true;
  latencyMs: number;
  accountNumber: string | null;
  status: string | null;
};

type HealthError = {
  ok: false;
  latencyMs: number;
  error: string;
};

export type BotHealth = HealthOk | HealthError;

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const startedAt = Date.now();
  const bots = await listBots();
  const bot = bots.find((b) => b.id === id);
  if (!bot) {
    return NextResponse.json(
      { ok: false, latencyMs: 0, error: `Bot "${id}" not found` } satisfies HealthError,
      { status: 404, headers: { "Cache-Control": "no-store" } }
    );
  }

  try {
    const result = (await runAlpaca("account", [], {
      accountId: bot.accountId,
    })) as { account_number?: string; status?: string };
    failureCounts().delete(id);
    return NextResponse.json(
      {
        ok: true,
        latencyMs: Date.now() - startedAt,
        accountNumber: result.account_number ?? null,
        status: result.status ?? null,
      } satisfies HealthOk,
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    // Auto-disable the bot after N consecutive failures so a revoked-key
    // bot stops paging the user every 60s with the same red dot. Skip if
    // the bot is already disabled — no value piling on more trips.
    if (bot.enabled) {
      const counts = failureCounts();
      const next = (counts.get(id) ?? 0) + 1;
      counts.set(id, next);
      if (next >= HEALTHCHECK_TRIP_THRESHOLD) {
        await recordSentinelTrip(bot, {
          botId: id,
          cap: HEALTHCHECK_TRIP_THRESHOLD,
          losingSymbols: [],
          reason: "healthcheck-failure",
          detail: errorMsg,
        }).catch(() => {
          // Don't let trip persistence failure mask the original error
          // from the caller — they still need the failure status.
        });
        counts.delete(id);
      }
    }
    return NextResponse.json(
      {
        ok: false,
        latencyMs: Date.now() - startedAt,
        error: errorMsg,
      } satisfies HealthError,
      { status: 200, headers: { "Cache-Control": "no-store" } }
    );
  }
}
