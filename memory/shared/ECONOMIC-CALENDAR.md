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
| 2026-05-18 | 10:00 | NAHB Housing Market Index | medium |  |  | Perplexity | 2026-05-18 |
| 2026-05-19 | 08:30 | Building Permits Preliminary | medium |  |  | Perplexity | 2026-05-18 |
| 2026-05-19 | 10:00 | Fed Speeches (Paulson, Venable) | medium |  |  | Perplexity | 2026-05-18 |
| 2026-05-20 | 08:30 | Housing Starts MoM | high |  | 10.8% | Perplexity | 2026-05-18 |
| 2026-05-20 | 12:30 | Initial Jobless Claims | high |  |  | Perplexity | 2026-05-18 |
| 2026-05-20 | 12:30 | Philadelphia Fed Manufacturing Index | high |  | 26.7 | Perplexity | 2026-05-18 |
| 2026-05-20 | 12:30 | Continuing Jobless Claims | medium |  |  | Perplexity | 2026-05-18 |
| 2026-05-20 | 12:30 | Jobless Claims 4-week Average | medium |  |  | Perplexity | 2026-05-18 |
| 2026-05-20 | 14:00 | FOMC Minutes (Powell's final mtg) | high |  |  | Perplexity | 2026-05-18 |
| 2026-05-20 | 16:00 | 15-Year Mortgage Rate | medium |  |  | Perplexity | 2026-05-18 |
| 2026-05-20 | 16:00 | 30-Year Mortgage Rate | medium |  |  | Perplexity | 2026-05-18 |
| 2026-05-20 | 17:00 | 10-Year TIPS Auction | medium |  | 1.896% | Perplexity | 2026-05-18 |
| 2026-05-20 | 20:30 | Fed Balance Sheet | medium |  |  | Perplexity | 2026-05-18 |
| 2026-05-21 | 10:00 | Fed Speeches | medium |  |  | Perplexity | 2026-05-18 |
| 2026-05-22 | 10:00 | Michigan Consumer Sentiment Final | high |  |  | Perplexity | 2026-05-18 |
