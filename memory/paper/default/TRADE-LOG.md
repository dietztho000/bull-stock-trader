# Trade Log (Paper Bot)

---

### Apr 30 — AMKR Entry

**BUY AMKR — 220 shares @ $68.14** (market order, filled Apr 30)
- Thesis: Q1 2026 record $1.685B (+27% YoY), EPS $0.33 beat. Q2 guide $1.75-1.85B. $300M buyback. Semiconductor packaging momentum.
- Stop: trailing 10% GTC (order 5614d6db, HWM $77.25, stop $69.52)
- Sector: Information Technology (position 1 of max 3)
- Week trades: 1/3

    entry_scorer: {
      "catalyst": 8,
      "momentum": 7,
      "risk_reward": 9,
      "stop_distance": 7,
      "total": 8
    }

---

### Apr 30 — NVDA Entry

**BUY NVDA — 95 shares @ $209.24** (market order, filled Apr 30)
- Thesis: AI chips dominant, data center demand accelerating. Next earnings May 20 AMC — must exit by May 19 per rule #13.
- Stop: trailing 10% GTC (order b2ed03ba, HWM $203.00, stop $182.70)
- Sector: Information Technology (position 2 of max 3)
- Week trades: 2/3

    entry_scorer: {
      "catalyst": 8,
      "momentum": 8,
      "risk_reward": 8,
      "stop_distance": 7,
      "total": 8
    }

---

### Apr 30 — XOM Entry

**BUY XOM — 120 shares @ $152.51** (market order, filled Apr 30)
- Thesis: Q1 beat $1.00 EPS. Golden Pass LNG Train 1 online. Guyana ramping. Energy sector +26% YTD.
- Stop: trailing 10% GTC (order 56b26674, HWM $155.00, stop $139.50)
- Sector: Energy (position 1 of max 3)
- Week trades: 3/3

    entry_scorer: {
      "catalyst": 8,
      "momentum": 9,
      "risk_reward": 8,
      "stop_distance": 7,
      "total": 8
    }

---

### May 04 — GOOGL Entry

**BUY GOOGL — 31 shares @ $382.79** (market order, filled May 04)
- Thesis: Q1 2026 massive beat — EPS $5.11 vs $2.66 est (+92%); Cloud +63% to $20B+. Analyst target $420. Breaking out.
- Stop: fixed stop-limit GTC stop $355.99 / limit $352.17 (order af2d7168)
- Sector: Communication Services (position 1 of max 3)
- Week trades: 1/3

    entry_scorer: {
      "catalyst": 9,
      "momentum": 8,
      "risk_reward": 8,
      "stop_distance": 7,
      "total": 8
    }

---

### May 05 10:08 CT — Mid-morning scan

- GOOGL: +1.29% — promotion PATCH attempted (stop-limit → trailing 10%). Alpaca replace-order returned new stop_limit (type unchanged; API does not support type conversion via PATCH). New order af2d7168 active with same fixed stop $355.99/$352.17. Fixed stop remains active and currently more protective than 10% trail from $387.74 ($348.97).
- AMKR: +13.10% — trailing 10%, HWM $77.25, stop $69.52. No action.
- NVDA: -5.70% — trailing 10%, HWM $203.00, stop $182.70. Not at -7% cut threshold ($194.49). Monitor.
- XOM: +0.77% — trailing 10%, HWM $155.00, stop $139.50. No action.
- No earnings exits, no take-profit ladder triggers, no unfilled limit buys to escalate.
