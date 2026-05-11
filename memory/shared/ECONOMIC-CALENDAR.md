# Economic Calendar — Cached upcoming US economic events

Cached macro-event lookups so the dashboard doesn't re-query Perplexity on
every page load. Refreshed by:

- **pre-market routine (STEP 3c)** — once per pre-market run for the next 14 days
- **dashboard `/calendar` "Refresh economic events" button** — manual on-demand refresh

Idempotency key: `(Date + Event)`. Existing rows are replaced in place, never
duplicated. Rows whose Date is before today are dropped on each refresh
(housekeeping).

Used by:
- **dashboard `/calendar`** — month grid + agenda list of upcoming events
- **dashboard Overview "Upcoming events" card** — 7-day strip
- **dashboard "Pre-Market Discord Brief"** — today's events section

`Importance` ∈ {`high`, `medium`, `low`}. `Source` is typically `Perplexity`
but may be `WebSearch` (fallback) or `manual` if the user hand-edits a row.

## Calendar
| Date | Time (ET) | Event | Importance | Forecast | Previous | Source | Date refreshed |
|------|-----------|-------|------------|----------|----------|--------|----------------|
| 2026-05-11 | 11:00 | Existing Home Sales | medium | 4.06M | 4.05M | Perplexity | 2026-05-11 |
| 2026-05-11 | 11:00 | MBA Mortgage Market Index | low |  | 285.3 | Perplexity | 2026-05-11 |
| 2026-05-11 | 14:30 | Fed Waller Speech | medium |  |  | Perplexity | 2026-05-11 |
| 2026-05-11 | 15:30 | Fed Collins Speech | medium |  |  | Perplexity | 2026-05-11 |
| 2026-05-12 | 08:30 | Consumer Price Index | high |  |  | Perplexity | 2026-05-11 |
| 2026-05-12 | 08:30 | Consumer Price Index MoM | high |  |  | Perplexity | 2026-05-11 |
| 2026-05-12 | 08:30 | CPI YoY | high |  |  | Perplexity | 2026-05-11 |
| 2026-05-12 | 08:30 | Core CPI MoM | high |  |  | Perplexity | 2026-05-11 |
| 2026-05-12 | 08:30 | Core CPI YoY | high |  |  | Perplexity | 2026-05-11 |
| 2026-05-12 | 08:30 | Real Earnings | low |  |  | Perplexity | 2026-05-11 |
| 2026-05-13 | 07:15 | Fed Williams Speech | medium |  |  | Perplexity | 2026-05-11 |
| 2026-05-13 | 08:30 | Producer Price Index | high |  |  | Perplexity | 2026-05-11 |
| 2026-05-13 | 08:30 | Producer Price Index MoM | high |  |  | Perplexity | 2026-05-11 |
| 2026-05-13 | 08:30 | PPI YoY | high |  |  | Perplexity | 2026-05-11 |
| 2026-05-13 | 10:00 | NFIB Business Optimism Index | medium | 96.2 | 96.1 | Perplexity | 2026-05-11 |
| 2026-05-13 | 12:15 | ADP Employment Change Weekly | high |  | 39.25K | Perplexity | 2026-05-11 |
| 2026-05-13 | 12:30 | Core Inflation Rate MoM | high |  |  | Perplexity | 2026-05-11 |
| 2026-05-13 | 17:00 | Fed Goolsbee Speech | medium |  |  | Perplexity | 2026-05-11 |
| 2026-05-13 | 17:00 | 10-Year Note Auction | medium |  | 4.282% | Perplexity | 2026-05-11 |
| 2026-05-13 | 18:00 | Monthly Budget Statement | medium | 179.0B | -164.1B | Perplexity | 2026-05-11 |
| 2026-05-14 | 08:30 | U.S. Import and Export Price Indexes | medium |  |  | Perplexity | 2026-05-11 |
| 2026-05-14 | 08:30 | Retail Sales Control Group MoM | high |  |  | Perplexity | 2026-05-11 |
| 2026-05-14 | 09:15 | Industrial Production and Capacity Utilization | high |  |  | Perplexity | 2026-05-11 |
| 2026-05-14 | 12:30 | Retail Sales MoM | high | 0.4% | 1.7% | Perplexity | 2026-05-11 |
| 2026-05-14 | 12:30 | Export Prices MoM | medium | 1.1% | 1.6% | Perplexity | 2026-05-11 |
| 2026-05-14 | 12:30 | Import Prices MoM | medium |  |  | Perplexity | 2026-05-11 |
| 2026-05-14 | 12:30 | Pending Home Sales YoY | medium |  | -1.1% | Perplexity | 2026-05-11 |
| 2026-05-15 | 10:00 | NY Empire State Manufacturing Index | medium |  | 11.00 | Perplexity | 2026-05-11 |
| 2026-05-15 | 10:00 | University of Michigan Consumer Sentiment Prel | high |  |  | Perplexity | 2026-05-11 |
| 2026-05-15 | 10:00 | Pending Home Sales YoY | medium |  | -1.1% | Perplexity | 2026-05-11 |
| 2026-05-15 | 10:00 | Occupational Employment and Wages | low |  |  | Perplexity | 2026-05-11 |
| 2026-05-15 | 14:00 | Senior Loan Officer Opinion Survey on Bank Lending Practices (SLOOS) | medium |  |  | Perplexity | 2026-05-11 |
| 2026-05-20 | 08:30 | Housing Starts MoM | high |  | 10.8% | Perplexity | 2026-05-11 |
| 2026-05-20 | 12:30 | Initial Jobless Claims | high |  |  | Perplexity | 2026-05-11 |
| 2026-05-20 | 12:30 | Philadelphia Fed Manufacturing Index | high |  | 26.7 | Perplexity | 2026-05-11 |
| 2026-05-20 | 12:30 | Continuing Jobless Claims | medium |  |  | Perplexity | 2026-05-11 |
| 2026-05-20 | 12:30 | Jobless Claims 4-week Average | medium |  |  | Perplexity | 2026-05-11 |
| 2026-05-20 | 14:00 | FOMC Minutes | high |  |  | Perplexity | 2026-05-11 |
| 2026-05-20 | 16:00 | 15-Year Mortgage Rate | medium |  |  | Perplexity | 2026-05-11 |
| 2026-05-20 | 16:00 | 30-Year Mortgage Rate | medium |  |  | Perplexity | 2026-05-11 |
| 2026-05-20 | 17:00 | 10-Year TIPS Auction | medium |  | 1.896% | Perplexity | 2026-05-11 |
| 2026-05-20 | 20:30 | Fed Balance Sheet | medium |  |  | Perplexity | 2026-05-11 |
