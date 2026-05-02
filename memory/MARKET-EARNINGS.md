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
| Symbol | Company | Earnings Date | BMO/AMC | EPS Estimate | Source | Date refreshed |
|--------|---------|---------------|---------|--------------|--------|----------------|
| BRK.B | Berkshire Hathaway | 2026-05-02 |  | $4.82 | Perplexity | 2026-05-01 |
| AMD | Advanced Micro Devices | 2026-05-05 | AMC |  | Perplexity | 2026-05-01 |
| PFE | Pfizer | 2026-05-05 | BMO | $0.71 | Perplexity | 2026-05-01 |
| DIS | Disney | 2026-05-06 | BMO | $1.49 | Perplexity | 2026-05-01 |
| MCD | McDonald's | 2026-05-07 | BMO | $2.75 | Perplexity | 2026-05-01 |
| HD | Home Depot | 2026-05-19 | BMO | $3.42 | Perplexity | 2026-05-01 |
| NVDA | NVIDIA | 2026-05-20 | AMC | $1.77 | Perplexity | 2026-05-01 |
| TGT | Target | 2026-05-20 | BMO | $1.34 | Perplexity | 2026-05-01 |
| WMT | Walmart | 2026-05-21 | BMO | $0.65 | Perplexity | 2026-05-01 |
| CRM | Salesforce | 2026-05-27 |  | $3.12 | Perplexity | 2026-05-01 |
| COST | Costco | 2026-05-28 | AMC |  | Perplexity | 2026-05-01 |
