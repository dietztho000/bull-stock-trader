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
| 2026-05-19 | 10:00 | JOLTS Job Openings Mar 2026 | high |  |  | Perplexity | 2026-05-19 |
| 2026-05-19 | 10:00 | NAR Existing Home Sales Apr 2026 | medium |  |  | Perplexity | 2026-05-19 |
| 2026-05-19 | 13:00 | Fed Waller Speech | medium |  |  | Perplexity | 2026-05-19 |
| 2026-05-20 | 08:30 | Housing Starts MoM | high |  | 10.8% | Perplexity | 2026-05-19 |
| 2026-05-20 | 12:30 | Initial Jobless Claims | high |  |  | Perplexity | 2026-05-19 |
| 2026-05-20 | 12:30 | Philadelphia Fed Manufacturing Index | high |  | 26.7 | Perplexity | 2026-05-19 |
| 2026-05-20 | 12:30 | Continuing Jobless Claims | medium |  |  | Perplexity | 2026-05-19 |
| 2026-05-20 | 12:30 | Jobless Claims 4-week Average | medium |  |  | Perplexity | 2026-05-19 |
| 2026-05-20 | 14:00 | FOMC Minutes | high |  |  | Perplexity | 2026-05-19 |
| 2026-05-20 | 16:00 | 15-Year Mortgage Rate | medium |  |  | Perplexity | 2026-05-19 |
| 2026-05-20 | 16:00 | 30-Year Mortgage Rate | medium |  |  | Perplexity | 2026-05-19 |
| 2026-05-20 | 17:00 | 10-Year TIPS Auction | medium |  | 1.896% | Perplexity | 2026-05-19 |
| 2026-05-20 | 20:30 | Fed Balance Sheet | medium |  |  | Perplexity | 2026-05-19 |
| 2026-05-21 | 08:30 | Initial Jobless Claims | high |  |  | Perplexity | 2026-05-19 |
| 2026-05-21 | 10:00 | New Residential Construction (Housing Starts) | high |  |  | Perplexity | 2026-05-19 |
| 2026-05-21 | 10:00 | NAR Pending Home Sales Index | medium |  |  | Perplexity | 2026-05-19 |
| 2026-05-22 | 08:30 | Personal Income and PCE Price Index | high |  |  | Perplexity | 2026-05-19 |
| 2026-05-22 | 10:00 | University of Michigan Consumer Sentiment Final | high |  |  | Perplexity | 2026-05-19 |
| 2026-05-22 | 10:00 | State Employment and Unemployment Mar 2026 | medium |  |  | Perplexity | 2026-05-19 |
| 2026-05-28 | 08:30 | GDP 2nd Estimate Q1 2026 | high |  |  | Perplexity | 2026-05-19 |
