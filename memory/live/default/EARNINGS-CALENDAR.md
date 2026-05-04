# Earnings Calendar — Cached next-earnings date per ticker

Cached earnings lookups so the routines don't query Perplexity for the same
ticker daily. The pre-market routine refreshes any row missing OR with
`Date refreshed` > 7 days ago for tickers in today's research plan AND
every open position.

Used by:
- **market-open** — refuses entry within 2 trading days of next earnings (rule #13)
- **mid-morning / late-morning / midday / afternoon** — force-exits any
  position whose `Next Earnings Date == today` after 11:00 CT
- **dashboard** — renders an "EPS in N d" badge on the LivePositions table

`BMO/AMC` indicates whether earnings print before market open or after market
close. `Source` is typically "Perplexity" but may be "manual" if the user
hand-edits a row.

## Calendar

| Symbol | Next Earnings Date | BMO/AMC | Source | Date refreshed |
|--------|--------------------|---------|--------|----------------|
| _first row appended on first ticker lookup_ | | | | |
