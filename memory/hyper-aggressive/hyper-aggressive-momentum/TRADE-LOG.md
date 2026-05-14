# Trade Log — Hyper-Aggressive Momentum

## Open Positions

| Date | Symbol | Side | Shares | Entry Price | Stop Trigger | Stop Limit | Target (+7%) | Sector | Status |
|------|--------|------|--------|-------------|-------------|-----------|--------------|--------|--------|
| 2026-05-14 | CSCO | BUY | 11 | $118.69 | $115.72 | $114.53 | $127.00 | Information Technology | OPEN |

## 2026-05-14 — CSCO Entry

**Trade:** BUY 11 CSCO @ $118.69 (limit fill)
**Order ID (buy):** 6b703730-3377-47ab-9b68-05f55337cc55
**Order ID (stop):** 6cfa4d48-e65b-4e1a-8fe5-451466d74901
**Stop:** $115.72 trigger / $114.53 limit (GTC stop-limit)
**Take-profit ladder trigger (7%):** ~$127.00 → sell 6 shares
**Trail promotion (2% gain):** $121.06 → activate 2% trailing stop
**Intraday only — must exit by EOD (no overnight holds)**

**Thesis:** Post-earnings gap-and-go. CSCO Q3 FY2026 beat: EPS $1.06 vs $1.04 (+1.92%), Rev $15.84B vs $15.56B (+1.71%), raised FY2026 guidance to $62.8-$63.0B vs $61.6B consensus. AI demand cited as primary driver. Gapped +16.3% from $101.87 → $118.69. 10M+ shares pre-market volume.

**Entry Scorer:**
```json
{
  "symbol": "CSCO",
  "date": "2026-05-14",
  "total": 8,
  "catalyst": 3,
  "momentum": 3,
  "rr": 1,
  "stop_distance": 1,
  "notes": "Post-earnings beat+raise. Beta ~0.9 typical but high intraday vol. R:R=2.8:1. Stop -2.5%, target +7%.",
  "target_pct": 0.14,
  "effective_equity": 10000,
  "position_cost": 1305.55,
  "position_pct": 13.06
}
```
