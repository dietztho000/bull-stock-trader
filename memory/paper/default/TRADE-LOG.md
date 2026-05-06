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

---

### May 05 14:02 CT — Afternoon scan

- AMKR: +12.31% (price $76.53) — trailing 10%, HWM $77.55, stop $69.795. Below +15% tighten threshold. No action.
- GOOGL: +0.94% (price $386.41) — trailing 10% confirmed (order efb5844c, HWM $388.56, stop $349.70). Late-morning promotion succeeded. No action.
- NVDA: -6.08% (price $196.52) — trailing 10%, HWM $203.00, stop $182.70. Approaching -7% cut floor ($194.59). No cut — exchange stop active. Earnings exit required by May 19 (rule #13).
- XOM: +1.47% (price $154.75) — trailing 10%, HWM $155.22, stop $139.70. No action.
- No earnings exits (next NVDA May 20, others Q3).
- No thesis breaks detected.
- No take-profit ladder triggers (<+20% all positions).
- No actions taken this scan.

---

### May 06 10:00 CT — Mid-morning scan

- AMKR: +12.36% (price $76.56) — trailing 10%, HWM $78.96, stop $71.06. Below +15% tighten threshold. No action.
- GOOGL: +3.85% (price $397.54) — trailing 10%, HWM $398.48, stop $358.63. No action.
- NVDA: -2.15% (price $204.75) — trailing 10%, HWM $205.83, stop $185.25. Not at -7% cut floor ($194.59). No action.
- XOM: -2.49% (price $148.72) — trailing 10%, HWM $155.29, stop $139.76. Not at -7% cut floor ($141.83). No action.
- No earnings exits (next: NVDA May 20 AMC — must exit by May 19 per rule #13).
- No take-profit ladder triggers (<+20% all positions).
- No unfilled limit buys to escalate.

---

### May 06 14:00 CT — Afternoon scan

- AMKR: +13.60% (price $77.41) — trailing 10%, HWM $78.96, stop $71.06. Below +15% tighten threshold. No action.
- GOOGL: +3.59% (price $396.53) — trailing 10%, HWM $399.85, stop $359.86. FOMC minutes (2PM ET) released — no adverse reaction, thesis intact. No action.
- NVDA: -0.99% (price $207.17) — trailing 10%, HWM $208.05, stop $187.25. +5.43% intraday recovery. Above -7% cut floor ($194.59). Earnings exit required by May 19 (rule #13). No action.
- XOM: -3.13% (price $147.73) — trailing 10%, HWM $155.29, stop $139.76. Energy sector -4.6% intraday; oil pressure continues. Above -7% cut floor ($141.83). Q1 beat + Golden Pass LNG thesis intact — fundamental not broken by short-term oil move. No action.
- No earnings exits today. No stops to promote (all trailing). No tightenings (<+15% all). No take-profit triggers (<+20% all).
- No thesis breaks detected.

---

### May 05 — EOD Snapshot (Day 4, Tuesday)
**Portfolio:** $101,558.20 | **Cash:** $34,963.49 (34.4%) | **Day P&L:** +$1,905.67 (+1.91%) | **Phase P&L:** +$1,558.20 (+1.56%)
**vs SPY:** day +1.06% alpha (SPY +0.85%) | phase -2.85% alpha

| Ticker | Shares | Entry | Close | Day Chg | Unrealized P&L | Stop |
|--------|--------|-------|-------|---------|----------------|------|
| AMKR | 220 | $68.14 | $77.25 | +8.86% | +$2,004.20 (+13.37%) | $69.80 |
| GOOGL | 31 | $382.79 | $395.49 | +3.19% | +$393.70 (+3.32%) | $349.70 |
| NVDA | 95 | $209.24 | $196.95 | -0.77% | -$1,167.77 (-5.88%) | $182.70 |
| XOM | 120 | $152.51 | $155.00 | +0.85% | +$298.80 (+1.63%) | $139.76 |

**Notes:** Strong close — portfolio +1.91% vs SPY +0.85%, +1.06% daily alpha. AMKR surged +8.86% to $77.25, 13.37% unrealized — approaching the +15% tighten threshold. GOOGL jumped +3.19% to $395.49, +3.32% unrealized, stop $349.70 (10% trail, HWM $388.56). NVDA slipped -0.77% but holds above the -7% cut floor; earnings exit required by May 19. XOM quiet +0.85%. No new trades; week at 1/3 cap. All four trailing stops active.

---

### May 06 — EOD Snapshot (Day 5, Wednesday)
**Portfolio:** $101,830.02 | **Cash:** $34,963.49 (34.3%) | **Day P&L:** +$271.82 (+0.27%) | **Phase P&L:** +$1,830.02 (+1.83%)
**vs SPY:** day -1.14% alpha (SPY +1.41%) | phase -4.05% alpha

| Ticker | Shares | Entry | Close | Day Chg | Unrealized P&L | Stop |
|--------|--------|-------|-------|---------|----------------|------|
| AMKR | 220 | $68.14 | $77.22 | +0.67% | +$1,997.60 (+13.33%) | $71.06 |
| GOOGL | 31 | $382.79 | $398.09 | +2.49% | +$474.29 (+4.00%) | $359.86 |
| NVDA | 95 | $209.24 | $207.42 | +5.56% | -$173.12 (-0.87%) | $187.44 |
| XOM | 120 | $152.51 | $148.58 | -4.07% | -$471.60 (-2.58%) | $139.76 |

**Notes:** Portfolio +0.27% vs SPY +1.41%, -1.14% daily alpha. XOM dragged -4.07% (Energy sector -4%+ intraday; oil pressure continuing) but thesis intact — Q1 beat + Golden Pass LNG; stop $139.76 holds. NVDA staged +5.56% intraday recovery, HWM $208.27, stop $187.44; earnings exit required by May 19 (rule #13). AMKR quiet +0.67%, holding +13.33% unrealized near HWM. GOOGL +2.49%, +4.00% unrealized, trailing stop $359.86 (FOMC minutes no adverse impact). No trades today; week at 1/3 cap. All four trailing stops active.
