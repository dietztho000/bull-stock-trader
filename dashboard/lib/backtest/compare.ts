// Comparison helpers: sim vs actual exit.

import type { BacktestResult, Trade } from "./types";

export type CompareReport = {
  pnlDelta: number | null;          // sim - actual
  pnlDeltaPct: number | null;       // (sim - actual) / |actual|
  dateDeltaDays: number | null;     // sim - actual (negative => exited earlier)
  reasonMatch: "match" | "mismatch" | "still_open";
};

function daysBetween(a: string, b: string): number {
  const da = new Date(a + "T00:00:00Z");
  const db = new Date(b + "T00:00:00Z");
  return Math.round((db.getTime() - da.getTime()) / 86_400_000);
}

export function compareToActual(
  result: BacktestResult,
  trade: Trade
): CompareReport {
  if (result.simExitReason === "still_open" || result.simPnl == null) {
    return {
      pnlDelta: null,
      pnlDeltaPct: null,
      dateDeltaDays: null,
      reasonMatch: "still_open",
    };
  }
  const pnlDelta = result.simPnl - trade.actualPnl;
  const pnlDeltaPct =
    Math.abs(trade.actualPnl) > 0
      ? pnlDelta / Math.abs(trade.actualPnl)
      : null;
  const dateDelta =
    result.simExitDate && trade.actualExitDate
      ? daysBetween(trade.actualExitDate, result.simExitDate)
      : null;
  // Reason match is qualitative — we can't know what reason actually
  // closed each live trade (SECTOR-LEDGER doesn't record exit_reason).
  // Use outcome as a proxy: a sim that ends in a loss-side reason
  // (stop_limit / gap_exit / earnings_exit on a losing trade) is a "match"
  // when the actual outcome was also a loss.
  const lossReasons = new Set([
    "stop_limit",
    "gap_exit",
    "gap_exit_no_fill",
    "earnings_exit",
  ]);
  const simIsLossExit = lossReasons.has(result.simExitReason);
  const actualIsLoss = trade.outcome === "L";
  const reasonMatch: "match" | "mismatch" =
    simIsLossExit === actualIsLoss ? "match" : "mismatch";
  return { pnlDelta, pnlDeltaPct, dateDeltaDays: dateDelta, reasonMatch };
}
