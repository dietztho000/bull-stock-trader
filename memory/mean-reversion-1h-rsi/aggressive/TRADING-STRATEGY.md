# Mean Reversion 1H RSI — Rule Book

## Mission
Capture short-term mean reversion in large-cap S&P 500 names. Edge comes from buying technically oversold conditions that are structurally bullish (above 200-day MA) and letting price snap back within two sessions.

## Universe & timeframes
- S&P 500 components only.
- 1h candles for entry signal; daily chart for trend filter.
- Earnings gate: no new entries within 2 trading days of an earnings announcement.

## Entry rules
1. 14-period RSI on 1h bars crosses **up through 30 from below** (full candle close required).
2. Price is **above the 200-day simple moving average** on the daily chart.
3. No earnings event within `EARNINGS_GATE_DAYS` trading days.
4. Total open positions is below `MAX_OPEN_POSITIONS`.
5. Intraday portfolio P&L has not breached `DAY_BREAKER_PCT`.
6. Entry score meets or exceeds `ENTRY_SCORE_MIN` (catalyst quality, R:R, sector tape).

## Position sizing
- Conviction-weighted via `CONVICTION_TABLE` (entry score → % of portfolio deployed).
- Hard 20% ceiling per single position regardless of score.
- Stay within `TARGET_DEPLOYED_LOW_PCT` – `TARGET_DEPLOYED_HIGH_PCT` total deployment band.

## Risk management
- **Stop trigger:** `STOP_TRIGGER_PCT` (-4%) below entry price.
- **Stop limit floor:** `STOP_LIMIT_PCT` (-5%) to cap slippage.
- **Day circuit breaker:** halt all new entries when intraday P&L ≤ `DAY_BREAKER_PCT` (-2%).
- **Week circuit breaker:** halt new entries for remainder of week when weekly P&L ≤ `WEEK_BREAKER_PCT` (-5%).
- **Sector cap:** no more than `SECTOR_CAP` positions in any single GICS sector.

## Exit rules
1. **Take-profit ladder:** sell 50% of position when price rises `TAKE_PROFIT_LADDER_PCT` (+6%) above entry.
2. **Trail promotion:** promote remainder to a trailing stop of `TRAIL_INITIAL_PCT` (3%) once ladder triggers.
3. **Trail tighten at +15%:** if price reaches `TRAIL_TIGHTEN_15_TRIGGER_PCT` above entry, tighten trail to `TRAIL_TIGHTEN_15_PCT`.
4. **Trail tighten at +20%:** if price reaches `TRAIL_TIGHTEN_20_TRIGGER_PCT` above entry, tighten trail further to `TRAIL_TIGHTEN_20_PCT`.
5. **Time stop:** hard close of any position that is **not green** by end of trading day 2 after entry, regardless of price.

## Hard NOs
- No options, futures, or leveraged instruments.
- No averaging down into a losing position.
- No entries below the 200-day MA.
- No entries within earnings gate window.
- No new entries after day or week circuit breaker has fired.
