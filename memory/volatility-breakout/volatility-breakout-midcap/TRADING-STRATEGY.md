# Volatility Breakout Mid-Cap — Rule Book

## Mission / Edge
Capture the early expansion phase of momentum moves in liquid mid-caps by entering confirmed 20-day range breakouts backed by volume conviction. ATR-based sizing and trailing keeps risk normalized across varying volatility regimes.

## Universe & Timeframe
- Market cap $1B–$50B (liquid mid-caps only).
- Daily candles for breakout signal and ATR calculation.
- Minimum average daily volume sufficient to support 1.5× surge filter.

## Entry Rules
1. Price closes or prints above the 20-day high (breakout candle).
2. Volume on breakout bar > 1.5× the 20-day average volume.
3. ATR(14) calculated on close of breakout bar; risk unit = 2× ATR.
4. No earnings announcement within 3 trading days (before or after).
5. Fewer than 4 open breakout positions at time of signal.
6. Portfolio day P&L has not breached −3% circuit breaker.
7. Entry score meets minimum threshold for position activation.

## Position Sizing
- Target 1% of total equity risk per position (1% equity ÷ (2× ATR in $) = share count).
- Absolute ceiling: 18% of portfolio equity per single position.
- ATR recalculated fresh at each entry; size locked at fill.

## Risk Management
- **Hard stop:** 2× ATR(14) below entry price, placed as stop-limit immediately on fill.
- **Day breaker:** If portfolio day P&L hits −3%, cancel all pending entries for remainder of session.
- **Earnings gate:** No new entries if earnings are within 3 calendar/trading days; exit existing if earnings surprise gate triggers.
- **Max concurrent:** 4 open breakout positions at any time.
- **Sector cap:** No more than 2 positions in the same GICS sector simultaneously.

## Exit Rules
1. **Trail promotion:** Once position reaches +1R (price ≥ entry + 2× ATR), switch to ATR trailing stop at 3× ATR below current high-water mark.
2. **Trail tightening at +15%:** Tighten trail to 1.5× ATR below high-water mark.
3. **Trail tightening at +20%:** Tighten trail to 1× ATR below high-water mark.
4. **Hard stop hit:** Exit immediately via stop-limit if 2× ATR level breached before trail promotion.
5. **Take-profit ladder:** Sell 50% of position at +2R; let trail manage remainder.

## Hard NOs
- No options, no leverage, no shorting.
- No entries on gap-up opens > 5% above prior close (chasing).
- No averaging down into a losing breakout.
- No re-entry on the same ticker within 5 trading days of a stop-out.
- No positions held through a known earnings event.
