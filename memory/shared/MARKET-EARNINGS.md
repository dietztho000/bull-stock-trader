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
| ARM | Arm Holdings | 2026-05-06 | AMC |  | Perplexity | 2026-05-06 |  |  |
| CVS | CVS Health | 2026-05-06 | BMO | $2.21 | Perplexity | 2026-05-06 |  |  |
| DIS | Disney | 2026-05-06 | BMO | $1.49 | Perplexity | 2026-05-06 |  |  |
| ABNB | Airbnb | 2026-05-07 | AMC | $0.30 | Perplexity | 2026-05-06 |  |  |
| COIN | Coinbase | 2026-05-07 | AMC | $0.26 | Perplexity | 2026-05-06 |  |  |
| DDOG | Datadog | 2026-05-07 | BMO | $0.50 | Perplexity | 2026-05-06 |  |  |
| GILD | Gilead Sciences | 2026-05-07 | AMC | $1.89 | Perplexity | 2026-05-06 |  |  |
| NET | Cloudflare | 2026-05-07 | AMC | $0.23 | Perplexity | 2026-05-06 |  |  |
| CSCO | Cisco Systems | 2026-05-13 | BMO | $1.02 | Perplexity | 2026-05-06 |  |  |
| AMAT | Applied Materials | 2026-05-14 | AMC | $2.67 | Perplexity | 2026-05-06 |  |  |
| HD | Home Depot | 2026-05-19 | BMO | $3.42 | Perplexity | 2026-05-06 |  |  |
| INTU | Intuit | 2026-05-20 | AMC | $12.24 | Perplexity | 2026-05-06 |  |  |
| LOW | Lowe's | 2026-05-20 | BMO |  | Perplexity | 2026-05-06 |  |  |
| NVDA | NVIDIA | 2026-05-20 | AMC | $1.77 | Perplexity | 2026-05-06 |  |  |
| TGT | Target | 2026-05-20 | BMO | $1.34 | Perplexity | 2026-05-06 |  |  |
| WMT | Walmart | 2026-05-21 | BMO | $0.65 | Perplexity | 2026-05-06 |  |  |
| CRM | Salesforce | 2026-05-27 | AMC | $3.12 | Perplexity | 2026-05-06 |  |  |
| MRVL | Marvell Technology | 2026-05-27 | AMC | $0.80 | Perplexity | 2026-05-06 |  |  |
| SNOW | Snowflake | 2026-05-27 | AMC | $0.32 | Perplexity | 2026-05-06 |  |  |
| COST | Costco | 2026-05-28 | AMC | $4.88 | Perplexity | 2026-05-06 |  |  |
| DELL | Dell Technologies | 2026-05-28 | AMC | $3.18 | Perplexity | 2026-05-06 |  |  |
| ZS | Zscaler | 2026-05-28 | AMC | $0.89 | Perplexity | 2026-05-06 |  |  |
| PANW | Palo Alto Networks | 2026-06-02 | AMC | $0.72 | Perplexity | 2026-05-06 |  |  |
| AVGO | Broadcom | 2026-06-03 | AMC | $2.40 | Perplexity | 2026-05-06 |  |  |
