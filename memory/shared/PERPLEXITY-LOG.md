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
| 2026-05-05 11:06 UTC | sonar | WTI and Brent oil price right now |
| 2026-05-05 11:06 UTC | sonar | S&P 500 futures premarket today May 5 2026 |
| 2026-05-05 11:06 UTC | sonar | VIX level today May 5 2026 |
| 2026-05-05 11:07 UTC | sonar | Top stock market catalysts today May 5 2026 |
| 2026-05-05 11:07 UTC | sonar | Earnings reports today May 5 2026 before market open US stocks |
| 2026-05-05 11:07 UTC | sonar | Economic calendar today May 5 2026 CPI PPI FOMC jobs data US |
| 2026-05-05 11:07 UTC | sonar | S&P 500 sector momentum YTD 2026 best performing sectors |
| 2026-05-05 11:07 UTC | sonar | AMKR Amkor Technology stock news May 2026 |
| 2026-05-05 11:07 UTC | sonar | GOOGL Google Alphabet stock news May 2026 earnings |
| 2026-05-05 11:08 UTC | sonar | NVDA Nvidia stock news May 2026 |
| 2026-05-05 11:08 UTC | sonar | XOM ExxonMobil stock news May 2026 |
| 2026-05-05 11:09 UTC | sonar | When is the next earnings report for AMKR Amkor Technology? Return the date in YYYY-MM-DD format and whether it is BMO (before market open) or AMC (after market close). |
| 2026-05-05 11:09 UTC | sonar | When is the next earnings report for GOOGL Alphabet? Return the date in YYYY-MM-DD format and whether it is BMO (before market open) or AMC (after market close). |
| 2026-05-05 11:09 UTC | sonar | When is the next earnings report for NVDA Nvidia? Return the date in YYYY-MM-DD format and whether it is BMO (before market open) or AMC (after market close). |
| 2026-05-05 11:09 UTC | sonar | When is the next earnings report for XOM ExxonMobil? Return the date in YYYY-MM-DD format and whether it is BMO (before market open) or AMC (after market close). |
| 2026-05-05 11:09 UTC | sonar | List all scheduled US economic events for the next 14 calendar days starting 2026-05-05. For each event return: date (YYYY-MM-DD), time (Eastern, HH:MM 24h), event name (e.g. CPI YoY, FOMC Minutes, In |
| 2026-05-06 13:37 UTC | sonar | Market open research for 2026-05-06: 1) SPY/QQQ pre-market direction, 2) VIX current level, 3) Key macro events today (GDP, Fed, economic data), 4) Top sector movers pre-market, 5) Any strong momentum |
| 2026-05-06 13:37 UTC | sonar | May 6 2026 premarket: 1) FOMC Fed rate decision today or this week? 2) US-China trade deal news this week? 3) COP ConocoPhillips stock setup — recent news and price action. 4) FCX Freeport-McMoRan s |
| 2026-05-06 13:38 UTC | sonar | Stock market May 6 2026: 1) AMKR Amkor Technology stock news and price today - any new catalysts. 2) NVDA Nvidia stock today - premarket direction. 3) XOM ExxonMobil stock today - oil price impact. 4) |
