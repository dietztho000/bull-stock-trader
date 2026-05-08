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
| 2026-05-08 | 08:30 | Employment Situation | high |  |  | Perplexity | 2026-05-08 |
| 2026-05-08 | 09:45 | Fed Cook Speech | medium |  |  | Perplexity | 2026-05-08 |
| 2026-05-08 | 10:00 | Consumer Sentiment | medium |  |  | Perplexity | 2026-05-08 |
| 2026-05-08 | 10:00 | Factory Orders | low |  |  | Perplexity | 2026-05-08 |
| 2026-05-08 | 12:30 | Non Farm Payrolls | high | 65K | 178K | Perplexity | 2026-05-08 |
| 2026-05-12 | 08:30 | Consumer Price Index | high |  |  | Perplexity | 2026-05-08 |
| 2026-05-12 | 08:30 | Real Earnings | low |  |  | Perplexity | 2026-05-08 |
| 2026-05-13 | 08:30 | Producer Price Index | high |  |  | Perplexity | 2026-05-08 |
| 2026-05-14 | 08:30 | U.S. Import and Export Price Indexes | medium |  |  | Perplexity | 2026-05-08 |
| 2026-05-14 | 12:30 | Retail Sales MoM | high | 0.1% | 1.7% | Perplexity | 2026-05-08 |
| 2026-05-14 | 12:30 | Export Prices MoM | medium | 1.1% | 1.6% | Perplexity | 2026-05-08 |
| 2026-05-14 | 12:30 | Import Prices MoM | medium |  |  | Perplexity | 2026-05-08 |
| 2026-05-15 | 10:00 | Occupational Employment and Wages | low |  |  | Perplexity | 2026-05-08 |
| 2026-05-20 | 14:00 | FOMC Minutes | high |  |  | Perplexity | 2026-05-08 |
