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
| 2026-05-05 | 09:00 | ISM Services Business Activity | medium |  |  | Perplexity | 2026-05-05 |
| 2026-05-05 | 10:00 | JOLTS Job Openings (March 2026) | medium |  |  | Perplexity | 2026-05-05 |
| 2026-05-05 | 15:00 | LMI Logistics Managers Index | low |  |  | Perplexity | 2026-05-05 |
| 2026-05-05 | 17:30 | Fed Goolsbee Speech | medium |  |  | Perplexity | 2026-05-05 |
| 2026-05-05 | 19:00 | Fed Hammack Speech | low |  |  | Perplexity | 2026-05-05 |
| 2026-05-06 | 08:30 | Q1 2026 GDP (Advance) | high |  |  | Perplexity | 2026-05-05 |
| 2026-05-07 | 09:15 | Industrial Production and Capacity Utilization | medium |  |  | Perplexity | 2026-05-05 |
| 2026-05-07 | 11:30 | Challenger Job Cuts | low |  | 60.62K | Perplexity | 2026-05-05 |
| 2026-05-07 | 15:00 | Consumer Credit | low |  |  | Perplexity | 2026-05-05 |
| 2026-05-07 | 17:00 | WASDE Report | medium |  |  | Perplexity | 2026-05-05 |
| 2026-05-07 | 17:00 | 10-Year Note Auction | medium |  | 4.282% | Perplexity | 2026-05-05 |
| 2026-05-07 | 18:00 | Monthly Budget Statement | medium |  | -$164.1B | Perplexity | 2026-05-05 |
| 2026-05-08 | 08:30 | Employment Situation April 2026 (Nonfarm Payrolls) | high |  |  | Perplexity | 2026-05-05 |
| 2026-05-12 | 08:30 | Consumer Price Index April 2026 | high |  |  | Perplexity | 2026-05-05 |
| 2026-05-12 | 08:30 | Real Earnings April 2026 | low |  |  | Perplexity | 2026-05-05 |
| 2026-05-13 | 08:30 | Producer Price Index April 2026 | high |  |  | Perplexity | 2026-05-05 |
| 2026-05-13 | 15:30 | 17-Week Bill Auction | low |  |  | Perplexity | 2026-05-05 |
| 2026-05-13 | 17:00 | 30-Year Bond Auction | high |  |  | Perplexity | 2026-05-05 |
| 2026-05-14 | 12:30 | Retail Sales MoM | high |  |  | Perplexity | 2026-05-05 |
| 2026-05-14 | 13:15 | Manufacturing Production YoY | medium | 0.5% |  | Perplexity | 2026-05-05 |
| 2026-05-14 | 17:00 | Baker Hughes Oil Rig Count | low |  |  | Perplexity | 2026-05-05 |
| 2026-05-18 | 10:00 | CB Consumer Confidence | high |  | 92.8 | Perplexity | 2026-05-05 |
| 2026-05-18 | 14:30 | Dallas Fed Manufacturing Index | medium |  | -2.3 | Perplexity | 2026-05-05 |
| 2026-05-18 | 17:00 | 2-Year Note Auction | medium |  |  | Perplexity | 2026-05-05 |
| 2026-05-20 | 14:00 | FOMC Minutes | high |  |  | Perplexity | 2026-05-05 |
| 2026-05-20 | 14:00 | Senior Loan Officer Opinion Survey (SLOOS) | medium |  |  | Perplexity | 2026-05-05 |
| 2026-05-20 | 17:00 | 20-Year Bond Auction | medium |  |  | Perplexity | 2026-05-05 |
