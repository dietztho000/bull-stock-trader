# Trade Log — EMA Crossover Momentum Bot

## Open Positions

| Date | Sym | Side | Shares | Entry | Stop Trigger | Stop Limit | Sector | Score |
|------|-----|------|--------|-------|-------------|------------|--------|-------|
| 2026-05-12 | AMD | BUY | 2 | $456.39 | $424.44 | $417.60 | Information Technology | 8/10 |

**AMD Entry Scorer:**
```json
{
  "ticker": "AMD",
  "date": "2026-05-12",
  "score": 8,
  "components": {
    "momentum_rank": 2,
    "ema_cross_strength": 2,
    "sector_tape": 2,
    "relative_volume": 2
  },
  "target_pct": 0.13,
  "effective_equity": 10000,
  "sizing": "2 shares @ $456.39 = $912.78 (9.1% of allocation)",
  "catalyst": "Q1 2026 AI beat (EPS $1.37 vs est, May 7) + US-China trade deal removing Nexperia probe / extending tariff exclusions",
  "stop_note": "Fixed stop-limit GTC $424.44/$417.60 (-7%/-8.5% from entry). Promote to 10% trailing once +10% (TRAIL_PROMOTION_PCT)"
}
```

**Thesis:** AMD continues AI-driven data center growth; Q1 showed record data center revenue. US-China trade deal reduces semi supply chain risk + removes China probe overhang. EMA golden cross on daily (EMA10=$391 > EMA50=$326 — 20% spread confirms strong trend). Next earnings Q2 ~Aug 4.

**Target:** $530+ (ADX-trend continuation to prior highs), trailing stop exit. R:R = $73.61 upside / $32.39 risk = 2.27:1.

---
