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
| 2026-05-18 | 12:30 | NY Fed Services Activity Index | medium |  | -14 | WebSearch | 2026-05-18 |
| 2026-05-18 | 14:00 | NAHB Housing Market Index | medium | 35 | 34 | WebSearch | 2026-05-18 |
| 2026-05-19 | 13:00 | Fed Waller Speech | medium |  |  | WebSearch | 2026-05-18 |
| 2026-05-19 | 14:00 | Pending Home Sales MoM | medium | 1.8% | 1.6% | WebSearch | 2026-05-18 |
| 2026-05-19 | 14:00 | Pending Home Sales YoY | medium | -0.5% | -1.1% | WebSearch | 2026-05-18 |
| 2026-05-20 | 12:00 | Fed Paulson Speech | medium |  |  | WebSearch | 2026-05-18 |
| 2026-05-20 | 14:15 | Fed Barr Speech | medium |  |  | WebSearch | 2026-05-18 |
| 2026-05-20 | 14:30 | EIA Crude Oil Stocks Change | medium |  | -4.306M | WebSearch | 2026-05-18 |
| 2026-05-20 | 18:00 | FOMC Minutes | high |  |  | WebSearch | 2026-05-18 |
| 2026-05-21 | 12:30 | Building Permits Prel | medium | 1.37M | 1.380M | WebSearch | 2026-05-18 |
| 2026-05-21 | 12:30 | Housing Starts | high | 1.45M | 1.420M | WebSearch | 2026-05-18 |
| 2026-05-21 | 12:30 | Initial Jobless Claims | high | 210.0K | 210K | WebSearch | 2026-05-18 |
| 2026-05-21 | 12:30 | Philadelphia Fed Manufacturing Index | high | 19 | 15.5 | WebSearch | 2026-05-18 |
| 2026-05-21 | 12:30 | Continuing Jobless Claims | medium | 1779.0K | 1782K | WebSearch | 2026-05-18 |
| 2026-05-21 | 13:45 | S&P Global Composite PMI Flash | medium | 51.5 | 51.7 | WebSearch | 2026-05-18 |
| 2026-05-21 | 13:45 | S&P Global Manufacturing PMI Flash | high | 53 | 53.8 | WebSearch | 2026-05-18 |
| 2026-05-21 | 13:45 | S&P Global Services PMI Flash | high | 51.1 | 51.3 | WebSearch | 2026-05-18 |
| 2026-05-21 | 14:30 | EIA Natural Gas Stocks Change | medium |  | 85Bcf | WebSearch | 2026-05-18 |
| 2026-05-22 | 14:00 | Michigan Consumer Sentiment Final | high | 48.2 | 48.2 | WebSearch | 2026-05-18 |
| 2026-05-22 | 14:00 | CB Leading Index MoM | medium |  | -0.3% | WebSearch | 2026-05-18 |
| 2026-05-22 | 15:00 | Fed Waller Speech | medium |  |  | WebSearch | 2026-05-18 |
| 2026-05-26 | 13:00 | S&P/Case-Shiller Home Price YoY | medium | 1.2% | 0.9% | WebSearch | 2026-05-18 |
| 2026-05-26 | 14:00 | CB Consumer Confidence | high |  | 92.8 | WebSearch | 2026-05-18 |
| 2026-05-27 | 14:00 | Richmond Fed Manufacturing Index | medium |  | 3 | WebSearch | 2026-05-18 |
| 2026-05-27 | 14:30 | Dallas Fed Services Index | medium |  | -9.9 | WebSearch | 2026-05-18 |
| 2026-05-28 | 12:30 | GDP Growth Rate QoQ 2nd Est | high | 2.0% | 2.0% | WebSearch | 2026-05-18 |
| 2026-05-28 | 12:30 | GDP Price Index QoQ 2nd Est | high | 4.5% | 3.7% | WebSearch | 2026-05-18 |
| 2026-05-28 | 12:30 | Core PCE Price Index MoM | high |  | 0.3% | WebSearch | 2026-05-18 |
| 2026-05-28 | 12:30 | Core PCE Price Index YoY | high |  | 3.2% | WebSearch | 2026-05-18 |
| 2026-05-28 | 12:30 | PCE Price Index MoM | high |  | 0.7% | WebSearch | 2026-05-18 |
| 2026-05-28 | 12:30 | PCE Price Index YoY | high |  | 3.5% | WebSearch | 2026-05-18 |
| 2026-05-28 | 12:30 | Initial Jobless Claims | high |  |  | WebSearch | 2026-05-18 |
| 2026-05-28 | 12:30 | Durable Goods Orders MoM | medium |  | 0.8% | WebSearch | 2026-05-18 |
| 2026-05-28 | 12:30 | Durable Goods Orders Ex Transp MoM | medium |  | 0.9% | WebSearch | 2026-05-18 |
| 2026-05-28 | 12:30 | Personal Income MoM | medium |  | 0.6% | WebSearch | 2026-05-18 |
| 2026-05-28 | 12:30 | Personal Spending MoM | medium |  | 0.9% | WebSearch | 2026-05-18 |
| 2026-05-28 | 14:00 | New Home Sales | high |  | 0.682M | WebSearch | 2026-05-18 |
| 2026-05-28 | 14:30 | EIA Natural Gas Stocks Change | medium |  |  | WebSearch | 2026-05-18 |
| 2026-05-29 | 12:30 | Goods Trade Balance Adv | medium |  | -$87.45B | WebSearch | 2026-05-18 |
| 2026-05-29 | 13:45 | Chicago PMI | high | 49.5 | 49.2 | WebSearch | 2026-05-18 |
| 2026-05-31 | 13:45 | S&P Global Manufacturing PMI Final | high |  | 54.5 | WebSearch | 2026-05-18 |
