# Hyper-Aggressive Momentum — Rule Book

## Mission
Capitalize on explosive intraday momentum bursts in high-volume, high-beta equities. Get in fast, ride the wave, and exit before it reverses. Speed and conviction over safety.

## Universe & Timeframes
- High-beta equities: beta > 1.5, ADV > 1M shares, price $5–$500.
- 5m candles for entry signal; 15m for trend confirmation.
- Watchlist refreshed pre-market from top % gainers and volume surgers.

## Entry Rules
1. Price breaks above prior 15m high on 5m candle close with volume ≥ 2× 20-bar average.
2. 5m EMA(9) > EMA(21) — short-term trend must be up.
3. RSI(7) on 5m between 55 and 80 — strong but not yet exhausted.
4. No earnings within EARNINGS_GATE_DAYS trading days.
5. Entry score ≥ ENTRY_SCORE_MIN (momentum, volume surge, sector tape, gap size).
6. Total open positions < MAX_OPEN_POSITIONS.

## Position Sizing
- Conviction-weighted via CONVICTION_TABLE (entry score → % of portfolio).
- Target deployed capital: TARGET_DEPLOYED_LOW_PCT – TARGET_DEPLOYED_HIGH_PCT.
- Hard cap: no single sector > SECTOR_CAP% of portfolio.

## Risk Management
- Hard stop trigger at STOP_TRIGGER_PCT from entry; limit floor at STOP_LIMIT_PCT.
- Day P&L circuit breaker: halt new entries if daily P&L < DAY_BREAKER_PCT.
- Week P&L circuit breaker: halt new entries if weekly P&L < WEEK_BREAKER_PCT.
- Max MAX_OPEN_POSITIONS concurrent positions — concentrate firepower.

## Exits
- Initial trail: TRAIL_INITIAL_PCT from high-water mark, activated at TRAIL_PROMOTION_PCT gain.
- Tighten trail to TRAIL_TIGHTEN_15_PCT once gain hits TRAIL_TIGHTEN_15_TRIGGER_PCT.
- Tighten trail to TRAIL_TIGHTEN_20_PCT once gain hits TRAIL_TIGHTEN_20_TRIGGER_PCT.
- Take-profit ladder: sell 50% at TAKE_PROFIT_LADDER_PCT; trail remainder.
- Hard time stop: close all positions at end of regular session — no overnight holds.

## Hard NOs
- No overnight holds. No exceptions.
- No averaging down.
- No positions in stocks with spread > 0.5%.
- No leverage beyond 1× (margin not used).
- No options.
- No trading in the first 5 minutes after open.
