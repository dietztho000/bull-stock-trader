# Trade Log — Volatility Breakout Mid-Cap

## Open Positions

_None yet — MOD conditional entry pending breakout fill_

## Pending Orders

| Date | Symbol | Side | Shares | Trigger | Limit | Stop (2×ATR) | Sector | Status |
|------|--------|------|--------|---------|-------|-------------|--------|--------|
| 2026-05-14 | MOD | BUY-STOP | 3 | $287.31 | $289.00 | $256.95 | Industrials | PENDING |

## 2026-05-14 — MOD Conditional Entry

**Order type:** Buy-stop-limit (conditional on 20-day high breakout)
**Order ID:** 1f2d622a-9d2d-417d-97d4-b022d5176f2b
**Trigger:** $287.31 (above 20-day high of $287.30)
**Limit:** $289.00 (fill cap on breakout)
**TIF:** day (expires EOD if no breakout)

**On fill, immediately place:**
- Stop-limit GTC: trigger $256.95 (entry - 2×ATR), limit $251.81 (-2% below trigger)
- Trail promotion at +1R ($317.31+): 3×ATR trailing stop
- Take-profit ladder at +2R ($348.03+): sell 1-2 shares

**Thesis:** Modine Manufacturing (data center thermal management) testing 20-day high breakout with projected 3.6× volume surge. Industrial Production data today may be a catalyst. Strong ATR signal ($15.18) confirming active trending range.

**Entry Scorer (provisional — confirmed on fill):**
```json
{
  "symbol": "MOD",
  "date": "2026-05-14",
  "total": 7,
  "catalyst": 2,
  "momentum": 2,
  "rr": 2,
  "stop_distance": 1,
  "notes": "Conditional 20d breakout pending. ATR-sized 1% risk. Volume projection 3.6x. R:R = 2:1 (at 2R target). Earnings May 27 (9d away).",
  "target_pct": 0.086,
  "effective_equity": 10000,
  "position_cost_estimate": 861.93,
  "position_pct_estimate": 8.62
}
```

**⚠️ NOTE: Protective stop must be placed on fill — midday routine to verify stop placement.**
