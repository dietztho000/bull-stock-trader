# Conservative Dividend Tilt — Rule Book

## Mission
Preserve capital by rotating into quality S&P 500 dividend payers during controlled pullbacks. Dividends compound; the strategy avoids speculation and leverage entirely.

## Universe & timeframe
- S&P 500 components with dividend yield > 2.5% and payout ratio < 75%.
- Daily candles for all signals and filters.
- Maximum 8 simultaneous holdings.

## Entry rules
1. Price has pulled back to within PULLBACK_BAND_PCT of the 50-day simple moving average.
2. 14-day RSI is below 45 (stock is cooling, not free-falling).
3. Dividend yield >= DIVIDEND_YIELD_MIN on latest data.
4. Payout ratio <= PAYOUT_RATIO_MAX; exclude dividend traps.
5. No earnings announcement within EARNINGS_GATE_DAYS trading days.
6. Day P&L circuit breaker: no new entries if intraday portfolio P&L is below DAY_BREAKER_PCT.
7. Entry score >= ENTRY_SCORE_MIN (fundamental quality, MA proximity, RSI depth, sector tape).

## Position sizing
- Equal-weight: every position targets exactly 8% of portfolio equity.
- Maximum 8 open positions (64% max theoretical deployment).
- Target deployed capital: TARGET_DEPLOYED_LOW_PCT – TARGET_DEPLOYED_HIGH_PCT.
- Do NOT add to an existing position; one lot per ticker.

## Risk
- Hard stop: close position when price falls STOP_TRIGGER_PCT from entry; no partial fills below STOP_LIMIT_PCT.
- No trailing stop — let dividend compounding work without premature exits on normal volatility.
- Day P&L circuit breaker at DAY_BREAKER_PCT: halt all new entries for the remainder of the session.
- Week P&L circuit breaker at WEEK_BREAKER_PCT: halt new entries for the remainder of the week.
- Sector cap: no more than SECTOR_CAP positions in any single GICS sector.

## Exits
- Stop-loss: hard -5% trigger, no trail.
- Fundamental deterioration: exit if dividend yield drops below DIVIDEND_YIELD_MIN or payout ratio exceeds PAYOUT_RATIO_MAX on next data refresh.
- Discretionary: exit if 50-day MA trends down for 10+ consecutive sessions while position is open.
- No fixed take-profit ladder; income accrues via dividends.

## Hard NOs
- No options, no leverage, no shorting.
- No averaging down into a losing position.
- No entries on stocks with payout ratio >= 75% regardless of yield.
- No entries within EARNINGS_GATE_DAYS days of an earnings event.
- No trailing stops — hard stop only.
