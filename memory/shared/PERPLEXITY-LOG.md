# Perplexity Query Log

Append-only log of every Perplexity API call. Daily-summary tallies the
day's calls and reports the count + estimated cost. If calls/day exceeds
2x the rolling 14-day median, daily-summary fires a Discord error — that
means a prompt regression is looping calls inside a single routine.

Pricing (sonar): roughly $0.0005 per query at the typical token shape used
by this bot. Update this header if the model or pricing changes.

## Queries

| Timestamp | Model | Query (truncated to 200 chars) |
|-----------|-------|--------------------------------|
| _populated by scripts/perplexity.sh on every call_ | | |
| 2026-04-30 22:29 UTC | sonar | What are today's key market catalysts and top momentum stock opportunities for April 30, 2026? Include: S&P 500 futures direction, VIX level, WTI oil price, top performing sectors this week, any major |
| 2026-04-30 22:29 UTC | sonar | April 30 2026 stock market: Give me 4 specific stock tickers with strong catalysts in the last 48 hours. Focus on: earnings beats this week, breakouts above resistance, sector leaders in Technology, E |
| 2026-05-01 21:09 UTC | sonar | S&P 500 weekly performance week ending May 1 2026, SPY ETF closing price May 1 2026 |
