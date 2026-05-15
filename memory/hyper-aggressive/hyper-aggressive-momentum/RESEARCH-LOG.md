## 2026-05-15 — Pre-Market Research (fallback, no prior entry)

**Market context:** S&P 500 near all-time highs; Technology and semis leading. Cisco (CSCO) +15% on earnings beat — AI infrastructure demand cited.

**Screened candidates:**
| Ticker | Spread | 5m Signal | Action |
|--------|--------|-----------|--------|
| AIIO   | 13.7%  | n/a       | BLOCKED: spread > 0.5% |
| RXT    | 15.6%  | n/a       | BLOCKED: spread > 0.5% |
| NVDA   | 0.35%  | unavail.  | BLOCKED: 5m SIP data unavailable |
| META   | 0.33%  | unavail.  | BLOCKED: 5m SIP data unavailable |

**Key blocker:** Paper subscription does not support intraday SIP data queries (HTTP 403 on 5Min bars). Cannot confirm EMA(9)>EMA(21), RSI 55-80, or volume surge signals required by strategy.

**Watchlist for when 5m data is available:** NVDA, META (tight spreads, liquid, high beta).

**Result:** NO TRADES — 5m intraday data unavailable; momentum signals unverifiable.
