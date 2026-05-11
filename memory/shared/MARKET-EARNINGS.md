# Market Earnings — Upcoming S&P 500 / mega-cap earnings calendar

Cached upcoming-earnings list for the dashboard's market-view calendar. This
file is **separate from EARNINGS-CALENDAR.md**:

- `EARNINGS-CALENDAR.md` is per-ticker cache for tickers the bot is researching
  or holding (used by rule #13 earnings gate).
- `MARKET-EARNINGS.md` is the broader market view — every S&P 500 / mega-cap
  reporting in the next ~30 days, regardless of whether the bot trades them.
  Used purely by the dashboard `/calendar` page and the Pre-Market Discord
  Brief; the bot's CLI routines do NOT read this file.

Refreshed by:

- **pre-market routine (STEP 3d)** — once per week (when `Date refreshed` is
  older than 7 days)
- **dashboard `/calendar` "Refresh market earnings" button** — manual on-demand

Idempotency: each refresh drops all `Perplexity`-sourced future rows and
re-inserts the new set. Manually-added rows (`Source = manual`) are
preserved across refreshes.

`BMO/AMC` indicates whether earnings print before market open or after market
close. `EPS Estimate` is a string ("$5.42", "$1.87", "—" when unknown).

## Calendar
| Symbol | Company | Earnings Date | BMO/AMC | EPS Estimate | Source | Date refreshed | Actual EPS | 1-day move % |
|--------|---------|---------------|---------|--------------|--------|----------------|------------|--------------|
| ARM | Arm Holdings | 2026-05-06 | AMC |  | Perplexity | 2026-05-06 | $0.60 | +12% |
| CVS | CVS Health | 2026-05-06 | BMO | $2.21 | Perplexity | 2026-05-06 | $2.57 | +9% |
| DIS | Disney | 2026-05-06 | BMO | $1.49 | Perplexity | 2026-05-06 | $1.57 | +7.54% |
| UBER | Uber Technologies | 2026-05-07 | BMO | $0.71 | Perplexity | 2026-05-07 | $0.72 | +8.6% |
| ABNB | Airbnb | 2026-05-07 | AMC | $0.31 | Perplexity | 2026-05-07 | $0.26 | -1.74% |
| COIN | Coinbase | 2026-05-07 | AMC | $0.26 | Perplexity | 2026-05-07 | -$1.49 | -2.5% |
| DDOG | Datadog | 2026-05-07 | BMO | $0.50 | Perplexity | 2026-05-07 | $0.60 | +31% |
| GILD | Gilead Sciences | 2026-05-07 | AMC | $1.83 | Perplexity | 2026-05-07 | $2.03 | -2.04% |
| MCD | McDonald's | 2026-05-07 | BMO | $2.74 | Perplexity | 2026-05-07 | $2.83 | -0.14% |
| NET | Cloudflare | 2026-05-07 | AMC | $0.23 | Perplexity | 2026-05-07 | $0.25 | -23.46% |
| CSCO | Cisco Systems | 2026-05-13 | BMO | $1.02 | Perplexity | 2026-05-11 |  |  |
| AMAT | Applied Materials | 2026-05-14 | AMC | $2.68 | Perplexity | 2026-05-11 |  |  |
| HD | Home Depot | 2026-05-19 | BMO | $3.42 | Perplexity | 2026-05-11 |  |  |
| INTU | Intuit | 2026-05-20 | AMC |  | Perplexity | 2026-05-11 |  |  |
| NVDA | NVIDIA | 2026-05-20 | AMC | $1.77 | Perplexity | 2026-05-11 |  |  |
| TGT | Target | 2026-05-20 | BMO | $1.34 | Perplexity | 2026-05-11 |  |  |
| DE | Deere & Company | 2026-05-21 | BMO | $5.81 | Perplexity | 2026-05-11 |  |  |
| WMT | Walmart | 2026-05-21 | BMO | $0.66 | Perplexity | 2026-05-11 |  |  |
| ZS | Zscaler | 2026-05-26 | AMC | $1.00 | Perplexity | 2026-05-11 |  |  |
| CRM | Salesforce | 2026-05-27 | AMC | $3.12 | Perplexity | 2026-05-11 |  |  |
| MRVL | Marvell Technology | 2026-05-27 | AMC | $0.80 | Perplexity | 2026-05-11 |  |  |
| SNOW | Snowflake | 2026-05-27 | AMC | $0.27 | Perplexity | 2026-05-11 |  |  |
| COST | Costco | 2026-05-28 | AMC | $4.91 | Perplexity | 2026-05-11 |  |  |
| DELL | Dell Technologies | 2026-05-28 | AMC | $2.95 | Perplexity | 2026-05-11 |  |  |
| AVGO | Broadcom | 2026-06-03 | AMC | $2.40 | Perplexity | 2026-05-11 |  |  |
| CRWD | CrowdStrike | 2026-06-03 | AMC | $1.10 | Perplexity | 2026-05-11 |  |  |
| ORCL | Oracle | 2026-06-10 | AMC | $1.96 | Perplexity | 2026-05-11 |  |  |
