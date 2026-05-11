# EMA Crossover Momentum — Rule Book

## Mission
Capture sustained directional trends in liquid equities by entering on confirmed EMA golden crosses. ADX filter ensures we only trade in genuinely trending environments, not choppy noise.

## Universe & timeframe
- US equities universe (screened for liquidity).
- Daily candles for all signals and filters.
- Max 3 positions per sector (SECTOR_CAP).
- Max 6 open positions total.

## Entry rules
1. 10-day EMA crosses above 50-day EMA (golden cross) on daily close.
2. ADX(14) > 25 at time of cross — confirms trend strength.
3. No earnings within EARNINGS_GATE_DAYS trading days.
4. Entry score >= ENTRY_SCORE_MIN (7–10 scale: momentum rank, distance from 200-day MA, sector tape, relative volume).
5. Weekly P&L has not breached WEEK_BREAKER_PCT circuit breaker.
6. Open positions < MAX_OPEN_POSITIONS and sector count < SECTOR_CAP.

## Position sizing
- Conviction-weighted using CONVICTION_TABLE (score → % of portfolio equity).
- Score 7 → 10%, 8 → 13%, 9 → 17%, 10 → 20%.
- Absolute per-position ceiling: 20%.

## Risk management
- Fixed stop: STOP_TRIGGER_PCT (-7%) stop-limit at entry; STOP_LIMIT_PCT (-8.5%) as slippage floor.
- Day circuit breaker: DAY_BREAKER_PCT (-2%) — no new entries if daily P&L breaches.
- Week circuit breaker: WEEK_BREAKER_PCT (-4%) — halt all new entries for remainder of week.
- Earnings gate: no open position through an earnings event within EARNINGS_GATE_DAYS days.

## Exit rules
1. **Stop**: hard stop at -7% from entry (stop-limit floor -8.5%).
2. **Trail promotion**: once position is green by TRAIL_PROMOTION_PCT (+10%), cancel fixed stop and apply TRAIL_INITIAL_PCT (10%) trailing stop.
3. **Tighten at +15%**: trail tightens to TRAIL_TIGHTEN_15_PCT (7%) when unrealised gain reaches TRAIL_TIGHTEN_15_TRIGGER_PCT.
4. **Tighten at +25%**: trail tightens further to TRAIL_TIGHTEN_20_PCT (5%) when unrealised gain reaches TRAIL_TIGHTEN_20_TRIGGER_PCT.
5. **Take-profit ladder**: sell 50% of position at TAKE_PROFIT_LADDER_PCT (+25%); trail the remaining half per tightened rules above.
6. **Cross reversal**: close position if 10-day EMA crosses back below 50-day EMA while still held.

## Hard NOs
- No options. No leverage. No short selling.
- No averaging down into a losing position.
- No new entries during earnings week for that ticker.
- No more than 3 tickers from the same GICS sector at any time.
