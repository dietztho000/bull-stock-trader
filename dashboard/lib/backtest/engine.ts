// Walk-forward exit-rule simulator. Pure function — no I/O.
//
// Encodes rules #4 (stop-limit + promotion), #6 (trail ratchet 10/7/5),
// #13 (earnings exit), #15 (pre-market gap), #16 (take-profit ladder).
// Cross-trade state (#14, #17, #20) is not modeled — those are entry-time
// rules and the backtest replays existing entries.
//
// Resolution: 1Day bars. The live bot promotes/tightens at intraday
// routines, so the daily simulator is coarser by design — 1Day is what
// Alpaca's free tier supplies and the user explicitly chose this trade-off.

import type {
  Bar,
  BacktestResult,
  ExitReason,
  Trade,
} from "./types";
import type { EarningsEntry } from "@/lib/parsers/earningsCalendar.shared";

/** Tunable exit-rule parameters. Cross-bot backtest (audit F8) lets the
 *  caller swap these so a paper bot's ratchet thresholds can be replayed
 *  against a live bot's trade history. Constants below are the defaults
 *  matching the live rulebook in CLAUDE.md. */
export type StrategyParams = {
  /** Stop trigger as fraction of entry — 0.93 = -7%. */
  stopTriggerPct: number;
  /** Stop-limit floor as fraction of entry — 0.92 = -8%. */
  stopLimitPct: number;
  /** Unrealized P&L fraction at which the fixed stop promotes to a trailing stop (0.01 = +1%). */
  promotionThreshold: number;
  /** Take-profit ladder fires at this unrealized P&L (0.20 = +20%, sell half). */
  ladderThreshold: number;
  /** Trail tightens to this fraction once unrealized P&L >= 15%. */
  trailTightenAt15: number;
  /** Trail tightens to this fraction once unrealized P&L >= 20%. */
  trailTightenAt20: number;
  /** Initial trailing-stop distance after promotion (0.10 = 10%). */
  defaultTrail: number;
  /** Force-exit at open if overnight gap is this fraction or worse (-0.07 = -7%). */
  gapExitPct: number;
  /** Hard cap on simulated holding period in calendar days — beyond this we
   *  surface as `still_open` so a forgotten position doesn't accrue
   *  unbounded "what if" P&L. */
  tradeWindowCapDays: number;
};

export const DEFAULT_STRATEGY_PARAMS: StrategyParams = {
  stopTriggerPct: 0.93,
  stopLimitPct: 0.92,
  promotionThreshold: 0.01,
  ladderThreshold: 0.2,
  trailTightenAt15: 0.07,
  trailTightenAt20: 0.05,
  defaultTrail: 0.1,
  gapExitPct: -0.07,
  tradeWindowCapDays: 30,
};

type StopState = "stop_limit" | "trailing";

function daysBetween(a: string, b: string): number {
  const da = new Date(a + "T00:00:00Z");
  const db = new Date(b + "T00:00:00Z");
  return Math.round((db.getTime() - da.getTime()) / 86_400_000);
}

function trailPctFor(plPct: number, params: StrategyParams): number {
  if (plPct >= 0.2) return params.trailTightenAt20;
  if (plPct >= 0.15) return params.trailTightenAt15;
  return params.defaultTrail;
}

export function simulateTrade(
  trade: Trade,
  bars: Bar[],
  earnings?: Map<string, EarningsEntry>,
  params: StrategyParams = DEFAULT_STRATEGY_PARAMS
): BacktestResult {
  const baseResult: Omit<BacktestResult, "simExitReason"> = {
    symbol: trade.symbol,
    entryDate: trade.entryDate,
    entryPrice: trade.entryPrice,
    shares: trade.shares,
    simExitDate: null,
    simExitPrice: null,
    simPnl: null,
    simPnlPct: null,
    ladderFired: false,
    ladderFireDate: null,
    ladderFirePrice: null,
    daysHeld: 0,
  };

  // Bars covering [entryDate, actualExitDate + buffer]. Only consider
  // bars strictly after the entry date (entry-day fill is at trade.entryPrice).
  const postEntryBars = bars
    .filter((b) => b.date > trade.entryDate)
    .sort((a, b) => a.date.localeCompare(b.date));

  if (postEntryBars.length === 0) {
    return { ...baseResult, simExitReason: "still_open" };
  }

  // State machine
  let stopState: StopState = "stop_limit";
  let stopPrice = trade.entryPrice * params.stopTriggerPct;
  const limitPrice = trade.entryPrice * params.stopLimitPct;
  let highestPrice = trade.entryPrice;
  let qty = trade.shares;
  let ladderFired = false;
  let ladderFireDate: string | null = null;
  let ladderFirePrice: number | null = null;
  let halfSellProceeds = 0;
  let halfSellQty = 0;

  let priorClose = trade.entryPrice;

  // Earnings calendar lookup is by symbol → entry's date field. The
  // calendar tracks the *next* earnings date; we treat that single date
  // as the trigger if it falls in our window.
  const earningsEntry = earnings?.get(trade.symbol.toUpperCase());
  const earningsDate = earningsEntry?.date ?? "";

  for (let i = 0; i < postEntryBars.length; i++) {
    const bar = postEntryBars[i];
    const heldDays = daysBetween(trade.entryDate, bar.date);
    if (heldDays > params.tradeWindowCapDays) {
      return finalize({
        baseResult,
        reason: "still_open",
        exitDate: bar.date,
        exitPrice: bar.close,
        qty,
        entryPrice: trade.entryPrice,
        halfSellProceeds,
        halfSellQty,
        ladderFired,
        ladderFireDate,
        ladderFirePrice,
        heldDays,
      });
    }

    // 1. Gap check (rule #15) — overnight gap from prior close.
    if (priorClose > 0) {
      const gap = (bar.open - priorClose) / priorClose;
      if (gap <= params.gapExitPct) {
        return finalize({
          baseResult,
          reason: "gap_exit",
          exitDate: bar.date,
          exitPrice: bar.open,
          qty,
          entryPrice: trade.entryPrice,
          halfSellProceeds,
          halfSellQty,
          ladderFired,
          ladderFireDate,
          ladderFirePrice,
          heldDays,
        });
      }
    }

    // 2. Earnings exit (rule #13) — force-close at close on earnings day.
    if (earningsDate && bar.date === earningsDate) {
      return finalize({
        baseResult,
        reason: "earnings_exit",
        exitDate: bar.date,
        exitPrice: bar.close,
        qty,
        entryPrice: trade.entryPrice,
        halfSellProceeds,
        halfSellQty,
        ladderFired,
        ladderFireDate,
        ladderFirePrice,
        heldDays,
      });
    }

    // 3. Stop trigger (rule #4 / #6).
    if (bar.low <= stopPrice) {
      if (stopState === "stop_limit" && bar.low < limitPrice) {
        // Stop-limit triggered but limit unfilled — fall through to next
        // bar's open as the realized exit.
        const next = postEntryBars[i + 1];
        const exitDate = next ? next.date : bar.date;
        const exitPrice = next ? next.open : bar.close;
        return finalize({
          baseResult,
          reason: "gap_exit_no_fill",
          exitDate,
          exitPrice,
          qty,
          entryPrice: trade.entryPrice,
          halfSellProceeds,
          halfSellQty,
          ladderFired,
          ladderFireDate,
          ladderFirePrice,
          heldDays: daysBetween(trade.entryDate, exitDate),
        });
      }
      // Slippage approximation: fill at min(stop_price, bar.open).
      const fillPrice = Math.min(stopPrice, bar.open);
      const reason: ExitReason =
        stopState === "trailing" ? "trailing_stop" : "stop_limit";
      return finalize({
        baseResult,
        reason,
        exitDate: bar.date,
        exitPrice: fillPrice,
        qty,
        entryPrice: trade.entryPrice,
        halfSellProceeds,
        halfSellQty,
        ladderFired,
        ladderFireDate,
        ladderFirePrice,
        heldDays,
      });
    }

    // 4. Ladder fire (rule #16) — checked at close.
    const closePlPct = (bar.close - trade.entryPrice) / trade.entryPrice;
    if (!ladderFired && closePlPct >= params.ladderThreshold && qty >= 2) {
      const sellQty = Math.floor(qty / 2);
      if (sellQty >= 1) {
        halfSellQty = sellQty;
        halfSellProceeds = sellQty * bar.close;
        qty -= sellQty;
        ladderFired = true;
        ladderFireDate = bar.date;
        ladderFirePrice = bar.close;
      }
    }

    // 5. Promotion (rule #4) — switch to trailing once green.
    if (stopState === "stop_limit" && closePlPct >= params.promotionThreshold) {
      stopState = "trailing";
      highestPrice = Math.max(highestPrice, bar.high);
      stopPrice = highestPrice * (1 - params.defaultTrail);
      // limitPrice no longer relevant for trailing stops.
    }

    // 6. Trail update — runs only after promotion.
    if (stopState === "trailing") {
      highestPrice = Math.max(highestPrice, bar.high);
      const tp = trailPctFor(closePlPct, params);
      const newStop = highestPrice * (1 - tp);
      // Never move stop down (matches the live PATCH-in-place rule).
      if (newStop > stopPrice) stopPrice = newStop;
    }

    priorClose = bar.close;
  }

  // Exhausted the bar window without hitting a rule.
  const lastBar = postEntryBars[postEntryBars.length - 1];
  return finalize({
    baseResult,
    reason: "still_open",
    exitDate: lastBar.date,
    exitPrice: lastBar.close,
    qty,
    entryPrice: trade.entryPrice,
    halfSellProceeds,
    halfSellQty,
    ladderFired,
    ladderFireDate,
    ladderFirePrice,
    heldDays: daysBetween(trade.entryDate, lastBar.date),
  });
}

function finalize(args: {
  baseResult: Omit<BacktestResult, "simExitReason">;
  reason: ExitReason;
  exitDate: string;
  exitPrice: number;
  qty: number;
  entryPrice: number;
  halfSellProceeds: number;
  halfSellQty: number;
  ladderFired: boolean;
  ladderFireDate: string | null;
  ladderFirePrice: number | null;
  heldDays: number;
}): BacktestResult {
  // Total P&L = remaining-half exit proceeds + half-sell proceeds (if any)
  //           - entry cost on the original full size.
  const totalEntryCost = args.baseResult.shares * args.entryPrice;
  const remainingExitProceeds = args.qty * args.exitPrice;
  const totalProceeds = remainingExitProceeds + args.halfSellProceeds;
  const simPnl = totalProceeds - totalEntryCost;
  const simPnlPct =
    totalEntryCost > 0 ? (simPnl / totalEntryCost) * 100 : null;

  return {
    ...args.baseResult,
    simExitDate: args.exitDate,
    simExitPrice: args.exitPrice,
    simExitReason: args.reason,
    simPnl,
    simPnlPct,
    ladderFired: args.ladderFired,
    ladderFireDate: args.ladderFireDate,
    ladderFirePrice: args.ladderFirePrice,
    daysHeld: args.heldDays,
  };
}
