# Trade Log — EMA Crossover Momentum

## Open Positions

| Date | Symbol | Side | Shares | Entry Price | Stop Trigger | Stop Limit | Target (+25%) | Sector | Status |
|------|--------|------|--------|-------------|-------------|-----------|--------------|--------|--------|
| 2026-05-14 | HWM | BUY | 3 | $274.48 | $255.27 | $251.15 | $343.10 | Industrials | OPEN |

## 2026-05-14 — HWM Entry

**Trade:** BUY 3 HWM @ $274.48 (market fill)
**Order ID (buy):** 35d19fec-d177-47f0-9fd7-dedbca45783a
**Order ID (stop):** cbaf2ba8-9218-4a4a-ac8e-8db9bfe6191f
**Stop:** $255.27 trigger / $251.15 limit (GTC stop-limit, -7% / -8.5%)
**Trail promotion at +10%:** $302.16 → activate 10% trailing stop
**Take-profit ladder at +25%:** $343.10 → sell 1-2 shares
**Exit signal:** EMA(10) crosses back below EMA(50) on daily close

**Thesis:** EMA golden cross (10d > 50d) on 2026-05-07, confirmed post-earnings gap. ADX(14) rising through 25 threshold (24.1 on Apr 24 → estimated 26-28 by May 7). Q1 2026 beat — Aerospace & Defense recovery, strong T12M momentum (+115%). +DI averaging 30+ (strong bullish pressure).

**Entry Scorer:**
```json
{
  "symbol": "HWM",
  "date": "2026-05-14",
  "total": 7,
  "catalyst": 2,
  "momentum": 2,
  "rr": 2,
  "stop_distance": 1,
  "notes": "Golden cross May 7, ADX ~26 estimated. Q1 beat catalyst 1 week old. R:R=3.57:1. Stop -7%, target +25%.",
  "target_pct": 0.10,
  "effective_equity": 10000,
  "position_cost": 823.44,
  "position_pct": 8.23
}
```
