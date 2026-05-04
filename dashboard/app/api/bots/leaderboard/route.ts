import { NextResponse } from "next/server";
import { listAccounts, listBots, type Bot } from "@/lib/settings";
import { botEquity } from "@/lib/bots/virtualEquity";
import { loadBenchmark } from "@/lib/parsers/benchmark";
import { loadSectorLedger } from "@/lib/parsers/sectorLedger";
import { drawdownSeries, maxDrawdown } from "@/lib/stats/drawdown";
import { currentWeekMondayCT } from "@/lib/time";
import type { AlpacaMode } from "@/lib/alpacaMode";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export type LeaderboardRow = {
  botId: string;
  name: string;
  mode: AlpacaMode;
  enabled: boolean;
  accountId: string;
  accountLabel: string | null;
  allocation: number | null;
  equity: number | null;
  cash: number | null;
  unrealizedPl: number | null;
  isVirtual: boolean;
  /** From the latest BENCHMARK row's Day % cell (already CT-bucketed by the
   *  bot's own EOD writeback). Null while the bot has zero recorded days. */
  dayPct: number | null;
  /** Phase alpha (portfolio − SPY) % from the latest BENCHMARK row. */
  phaseAlphaPct: number | null;
  /** Trades closed since current-week-Monday in CT — uses SECTOR-LEDGER's
   *  closed table. Excludes still-open positions. */
  tradesThisWeek: number;
  /** Worst peak-to-trough drawdown over the bot's BENCHMARK history, as a
   *  fraction (-0.12 = -12%). Null when the bot has < 2 days of data. */
  maxDrawdownPct: number | null;
  /** Set when any of the upstream fetches failed (e.g. credentials revoked,
   *  memory tree missing) — UI shows the row but flags it as degraded. */
  error: string | null;
};

async function rowFor(
  bot: Bot,
  accountLabel: string | null,
  mode: AlpacaMode
): Promise<LeaderboardRow> {
  const ctx = { bot: bot.id, strategy: bot.strategySlug };
  const errors: string[] = [];

  const [equityRes, benchmarkRes, ledgerRes] = await Promise.allSettled([
    botEquity(bot.id),
    loadBenchmark(ctx),
    loadSectorLedger(ctx),
  ]);

  const equity = equityRes.status === "fulfilled" ? equityRes.value : null;
  if (equityRes.status === "rejected") {
    errors.push(equityRes.reason instanceof Error ? equityRes.reason.message : String(equityRes.reason));
  }

  const benchmark = benchmarkRes.status === "fulfilled" ? benchmarkRes.value : null;
  const ledger = ledgerRes.status === "fulfilled" ? ledgerRes.value : null;

  const lastRow = benchmark && benchmark.rows.length > 0
    ? benchmark.rows[benchmark.rows.length - 1]
    : null;

  const dd = benchmark ? drawdownSeries(benchmark.rows) : [];
  const maxDd = dd.length > 0 ? maxDrawdown(dd) : null;

  const mondayStr = currentWeekMondayCT();
  const tradesThisWeek = ledger
    ? ledger.closed.filter((t) => t.date >= mondayStr).length
    : 0;

  return {
    botId: bot.id,
    name: bot.name,
    mode,
    enabled: bot.enabled,
    accountId: bot.accountId,
    accountLabel,
    allocation: bot.allocation,
    equity: equity?.equity ?? null,
    cash: equity?.cash ?? null,
    unrealizedPl: equity?.unrealizedPl ?? null,
    isVirtual: equity?.isVirtual ?? false,
    dayPct: lastRow?.dayPct ?? null,
    phaseAlphaPct: lastRow?.alphaPhase ?? null,
    tradesThisWeek,
    maxDrawdownPct: maxDd ? maxDd.pct : null,
    error: errors.length > 0 ? errors.join("; ") : null,
  };
}

export async function GET() {
  try {
    const [bots, accounts] = await Promise.all([listBots(), listAccounts()]);
    const accountById = new Map(accounts.map((a) => [a.id, a]));
    // Fan out per-bot fetches in parallel — no single slow bot blocks the
    // others, and a credential failure on one is isolated to that row.
    const rows = await Promise.all(
      bots.map((b) => {
        const acct = accountById.get(b.accountId);
        return rowFor(b, acct?.label ?? null, acct?.mode ?? "paper");
      })
    );
    return NextResponse.json(
      { rows },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
