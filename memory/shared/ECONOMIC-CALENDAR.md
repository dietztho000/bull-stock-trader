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
| 2026-05-01 | 11:00 | 6-Month Bill Auction | low |  |  | Perplexity | 2026-05-01 |
| 2026-05-02 | 08:30 | Case-Shiller Home Price Index | medium |  |  | Perplexity | 2026-05-01 |
| 2026-05-02 | 08:30 | FHFA House Price Index | low |  |  | Perplexity | 2026-05-01 |
| 2026-05-02 | 10:00 | Consumer Confidence | high |  |  | Perplexity | 2026-05-01 |
| 2026-05-02 | 10:00 | Richmond Fed Manufacturing Index | medium |  |  | Perplexity | 2026-05-01 |
| 2026-05-04 | 08:30 | Employment Situation April 2026 | high |  |  | Perplexity | 2026-05-01 |
| 2026-05-06 | 08:30 | Q1 2026 GDP | high |  |  | Perplexity | 2026-05-01 |
| 2026-05-07 | 09:15 | Industrial Production and Capacity Utilization | medium |  |  | Perplexity | 2026-05-01 |
| 2026-05-07 | 15:00 | Consumer Credit | low |  |  | Perplexity | 2026-05-01 |
| 2026-05-12 | 08:30 | Consumer Price Index April 2026 | high |  |  | Perplexity | 2026-05-01 |
| 2026-05-12 | 08:30 | Real Earnings April 2026 | low |  |  | Perplexity | 2026-05-01 |
| 2026-05-13 | 08:30 | Producer Price Index April 2026 | high |  |  | Perplexity | 2026-05-01 |
| 2026-05-14 | 17:00 | 17-Week Bill Auction | low |  |  | Perplexity | 2026-05-01 |
| 2026-05-14 | 17:00 | 30-Year Bond Auction | medium |  |  | Perplexity | 2026-05-01 |
| 2026-05-20 | 14:00 | FOMC Minutes | high |  |  | Perplexity | 2026-05-01 |
| 2026-05-20 | 17:00 | 17-Week Bill Auction | low |  |  | Perplexity | 2026-05-01 |
| 2026-05-20 | 17:00 | 20-Year Bond Auction | medium |  |  | Perplexity | 2026-05-01 |
