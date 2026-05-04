// Shared types for the backtest harness (rule #12 — live-trade replay).
//
// The engine is exit-only: entries are taken as ground truth from
// SECTOR-LEDGER + TRADE-LOG. Each closed trade is replayed against the
// current exit rules (stop-limit, promotion, trail ratchet, take-profit
// ladder, gap exit, earnings exit) and compared to the actual exit.

export type ExitReason =
  | "stop_limit"        // -7% trigger / -8% limit fill
  | "trailing_stop"     // promoted trail (10% / 7% / 5%)
  | "gap_exit"          // overnight gap <= -7% from prior close
  | "gap_exit_no_fill"  // stop-limit triggered but limit unfilled — exited at next open
  | "earnings_exit"     // forced exit on earnings day
  | "actual_exit"       // sim ran past actual exit date — fall back to real exit
  | "still_open";       // bar window ended before any rule fired

// Inputs the engine consumes per trade. Joined from SECTOR-LEDGER (date,
// symbol, sector, entry price, exit price, P&L, outcome) and TRADE-LOG
// entries (shares, entry-scorer block).
export type Trade = {
  symbol: string;
  sector: string;
  entryDate: string;          // YYYY-MM-DD
  entryPrice: number;
  shares: number;             // from TRADE-LOG entry
  actualExitDate: string;     // YYYY-MM-DD
  actualExitPrice: number;
  actualPnl: number;
  actualPnlPct: number;       // already in percent units (e.g. -7.0)
  outcome: "W" | "L" | "B";
};

// Daily bar shape. Matches Alpaca's bars endpoint: t (timestamp),
// o/h/l/c (OHLC), v (volume — not used by the engine).
export type Bar = {
  date: string;   // YYYY-MM-DD (extracted from `t` ISO)
  open: number;
  high: number;
  low: number;
  close: number;
};

export type BacktestResult = {
  symbol: string;
  entryDate: string;
  entryPrice: number;
  shares: number;
  // Simulated outcome
  simExitDate: string | null;
  simExitPrice: number | null;
  simExitReason: ExitReason;
  simPnl: number | null;
  simPnlPct: number | null;
  // Half-sell ladder fired? When true, simPnl includes both the
  // half-sell proceeds and the remaining half's exit.
  ladderFired: boolean;
  ladderFireDate: string | null;
  ladderFirePrice: number | null;
  daysHeld: number;
};

export type ExitReasonBreakdown = Partial<Record<ExitReason, number>>;

export type BacktestSummary = {
  runDate: string;          // YYYY-MM-DD when the backtest was run
  tradeCount: number;
  totalActualPnl: number;
  totalSimPnl: number;
  pnlDelta: number;         // sim - actual
  ladderFireRate: number;   // 0..1 — fraction of trades that hit +20%
  reasonBreakdown: ExitReasonBreakdown;
  // Pulled from BENCHMARK / dashboard stats so the curve overlay has
  // anchor points: cumulative actual vs cumulative sim P&L by date.
  cumulativeActual: { date: string; pnl: number }[];
  cumulativeSim: { date: string; pnl: number }[];
  /** Bot whose TRADE-LOG / SECTOR-LEDGER provided the closed trades. Optional
   *  for back-compat with snapshots written before audit F8. */
  tradeSourceBot?: string;
  /** Bot whose strategy params were used for simulation. May equal
   *  `tradeSourceBot` (same-bot replay) or differ for cross-bot experiments. */
  strategySourceBot?: string;
  /** Snapshot of the exit-rule params used. Surfaced in the UI so users can
   *  tell which overrides produced this run (audit F8 cross-bot framing). */
  strategyParamsUsed?: Record<string, number>;
};
