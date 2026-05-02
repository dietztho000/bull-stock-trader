// Top-level backtest orchestrator. Server-side only — calls runAlpaca to
// fetch historical bars per trade.

import { runAlpaca, type AlpacaMode } from "@/lib/alpaca";
import { loadSectorLedger, type ClosedTrade } from "@/lib/parsers/sectorLedger";
import { loadTradeLog, type TradeEntry } from "@/lib/parsers/tradeLog";
import { loadEarningsCalendar } from "@/lib/parsers/earningsCalendar";
import { simulateTrade } from "./engine";
import type {
  Bar,
  BacktestResult,
  BacktestSummary,
  ExitReasonBreakdown,
  Trade,
} from "./types";

const BAR_BUFFER_DAYS = 5; // pad the bars window so trail/promotion has room

type AlpacaBarsResp = {
  bars?: Array<{ t: string; o: number; h: number; l: number; c: number }>;
};

function isoDate(s: string): string {
  return s.slice(0, 10);
}

function addDays(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function findEntry(
  trade: ClosedTrade,
  entries: TradeEntry[]
): TradeEntry | null {
  // Exact match by ticker + date first; fall back to ticker-only nearest
  // entry on/before the closed trade's date.
  const byExact = entries.find(
    (e) =>
      e.ticker.toUpperCase() === trade.symbol.toUpperCase() &&
      e.date === trade.date
  );
  if (byExact) return byExact;
  const sameTicker = entries
    .filter((e) => e.ticker.toUpperCase() === trade.symbol.toUpperCase())
    .filter((e) => e.date && e.date <= trade.date)
    .sort((a, b) => (a.date! > b.date! ? -1 : 1));
  return sameTicker[0] ?? null;
}

function joinTrade(closed: ClosedTrade, entries: TradeEntry[]): Trade | null {
  if (
    closed.entry == null ||
    closed.exit == null ||
    closed.pnl == null ||
    !closed.date
  ) {
    return null;
  }
  const entry = findEntry(closed, entries);
  // Need shares and exit date. Shares come from TRADE-LOG. Exit date is the
  // close-trade row's `date` field — SECTOR-LEDGER records the exit date.
  // Entry date: use the joined entry's `date` if available; otherwise fall
  // back to closed.date (sim window will be a single-day no-op then).
  const entryDate = entry?.date ?? closed.date;
  const exitDate = closed.date;
  const shares = entry?.shares ?? null;
  if (shares == null) return null;
  const outcome: Trade["outcome"] =
    closed.outcome === "W" || closed.outcome === "L" || closed.outcome === "B"
      ? closed.outcome
      : "B";
  return {
    symbol: closed.symbol,
    sector: closed.sector,
    entryDate,
    entryPrice: closed.entry,
    shares,
    actualExitDate: exitDate,
    actualExitPrice: closed.exit,
    actualPnl: closed.pnl,
    actualPnlPct: closed.pnlPct ?? 0,
    outcome,
  };
}

async function fetchBars(
  symbol: string,
  start: string,
  end: string,
  mode: AlpacaMode
): Promise<Bar[]> {
  // Pull a generous window so sim has bars before entry (gap-prior-close)
  // and after exit (still_open / trail trip lookahead).
  const startBuffered = addDays(start, -1);
  const endBuffered = addDays(end, BAR_BUFFER_DAYS);
  try {
    const resp = (await runAlpaca(
      "bars",
      [symbol, "1Day", startBuffered, endBuffered, "100"],
      { mode }
    )) as AlpacaBarsResp;
    const bars = resp.bars ?? [];
    return bars
      .map((b) => ({
        date: isoDate(b.t),
        open: b.o,
        high: b.h,
        low: b.l,
        close: b.c,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
  } catch {
    return [];
  }
}

export async function runBacktest(
  mode: AlpacaMode = "paper"
): Promise<{ summary: BacktestSummary; results: BacktestResult[] }> {
  const [ledger, tradeLog, earnings] = await Promise.all([
    loadSectorLedger(),
    loadTradeLog(),
    loadEarningsCalendar().catch(() => new Map()),
  ]);

  const trades = ledger.closed
    .map((c) => joinTrade(c, tradeLog.entries))
    .filter((t): t is Trade => t !== null);

  const results: BacktestResult[] = [];
  for (const trade of trades) {
    const bars = await fetchBars(
      trade.symbol,
      trade.entryDate,
      trade.actualExitDate,
      mode
    );
    if (bars.length === 0) {
      // No bars — skip with a "still_open" placeholder so the row appears
      // in the table with a "no data" badge.
      results.push({
        symbol: trade.symbol,
        entryDate: trade.entryDate,
        entryPrice: trade.entryPrice,
        shares: trade.shares,
        simExitDate: null,
        simExitPrice: null,
        simExitReason: "still_open",
        simPnl: null,
        simPnlPct: null,
        ladderFired: false,
        ladderFireDate: null,
        ladderFirePrice: null,
        daysHeld: 0,
      });
      continue;
    }
    results.push(simulateTrade(trade, bars, earnings));
  }

  // Aggregate
  const reasonBreakdown: ExitReasonBreakdown = {};
  for (const r of results) {
    reasonBreakdown[r.simExitReason] =
      (reasonBreakdown[r.simExitReason] ?? 0) + 1;
  }
  const totalActualPnl = trades.reduce((acc, t) => acc + t.actualPnl, 0);
  const totalSimPnl = results.reduce((acc, r) => acc + (r.simPnl ?? 0), 0);
  const ladderFires = results.filter((r) => r.ladderFired).length;
  const ladderFireRate = results.length > 0 ? ladderFires / results.length : 0;

  // Cumulative curves keyed by exit date (sim) / actual exit date.
  const cumActual = buildCumulative(
    trades.map((t) => ({ date: t.actualExitDate, pnl: t.actualPnl }))
  );
  const cumSim = buildCumulative(
    results
      .filter((r) => r.simExitDate && r.simPnl != null)
      .map((r) => ({ date: r.simExitDate as string, pnl: r.simPnl as number }))
  );

  const runDate = new Date().toISOString().slice(0, 10);
  return {
    summary: {
      runDate,
      tradeCount: trades.length,
      totalActualPnl,
      totalSimPnl,
      pnlDelta: totalSimPnl - totalActualPnl,
      ladderFireRate,
      reasonBreakdown,
      cumulativeActual: cumActual,
      cumulativeSim: cumSim,
    },
    results,
  };
}

function buildCumulative(
  rows: { date: string; pnl: number }[]
): { date: string; pnl: number }[] {
  const sorted = [...rows].sort((a, b) => a.date.localeCompare(b.date));
  const out: { date: string; pnl: number }[] = [];
  let running = 0;
  for (const r of sorted) {
    running += r.pnl;
    out.push({ date: r.date, pnl: running });
  }
  return out;
}
