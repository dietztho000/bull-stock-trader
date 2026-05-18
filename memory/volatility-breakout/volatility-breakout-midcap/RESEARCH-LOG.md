# Research Log — Volatility Breakout Bot

---

## 2026-05-18 — Pre-Market Research

### Account Snapshot
- Equity: $9,945.37 | Cash: $9,135.37 (91.9%) | Buying Power: $19,080.74
- Open positions: 1 (MOD) | DT count: 0 | Phase P&L: -$54.63 on position
- last_equity $9,949.15 → equity $9,945.37 → overnight move: -$3.78

### ⚠️ CRITICAL — Open Position: MOD (Modine Manufacturing)
- 3 shares @ $288.21 entry | Current: $270.00 | Unrealized: -$54.63 (-6.32%)
- Trailing stop GTC: 10%, HWM $293.89, current stop ~$264.50 (ACTIVE)
- **EARNINGS GATE ALERT: MOD reports Q4 FY2026 AMC May 26, 2026**
  - EARNINGS_GATE_DAYS = 3 for this strategy
  - 3 trading days before May 26 (with May 25 = Memorial Day holiday) = May 20 (Wed)
  - **MUST EXIT MOD by EOD May 19 (Tuesday) at latest**
  - Today (Mon May 18) and Tue May 19 are the last valid trading days
- Price action: MOD down from HWM $293.89 to $270.00 — trailing stop at $264.50
  - Gap to stop: $5.50 (2.0% decline from here triggers stop-out)
  - Data center cooling thesis intact but stock giving back gains
- Action: Let trailing stop manage or plan active exit by May 19 close (whichever comes first)
- ATR(14) at entry: ~$16.19. 2× ATR from entry = $256.00 (hard stop floor). Current stop $264.50 provides more protection.

### Market Context
- WTI: $107.45 | Brent: $110.91 | VIX: ~17.87 (expiration day)
- S&P futures: ~7,400-7,450 | FOMC Minutes Wed May 20 | NVDA earnings Wed AMC
- Today: NAHB Housing 10:00 ET (medium) — light data day
- Energy sector leading YTD (+32.6%); this week: FOMC minutes + NVDA earnings = binary event risk Wed
- April PPI hot (+6.0% YoY) — macro uncertainty elevated

### Trade Ideas
- **NO NEW ENTRIES TODAY** — reason: MOD requires mandatory exit by May 19; opening a new breakout position while managing a forced-exit scenario adds complexity and capital risk
- After MOD is closed, scan for new 20-day breakout setups in energy mid-caps (OVV, FANG, AR) given oil surge
- Candidate watchlist post-MOD exit: OVV (Ovintiv, ~$15-30B mcap, energy mid-cap), AR (Antero Resources)

### Sector Check
- SECTOR-LEDGER.md: empty — no restrictions
- MOD sector: Industrials (GICS). After exit, Industrial sector opens back up.

### Risk Factors
- MOD stop ~$2.79 decline away from trigger — may get stopped out today
- Earnings gate hard deadline: EOD May 19 — no negotiation
- FOMC + NVDA Wed creates volatility overhang for rest of week; any new entry this week faces that
- Oil price reversal risk at $107 — elevated level historically

### Decision: HOLD MOD (let trail manage) — EXIT latest EOD May 19. NO new entries today.

---

## 2026-05-14 — Midday addendum

**MOD (Modine Manufacturing)**: +4.23% intraday to $291.00 (entry $288.21, +0.97% from cost). 
- Driver: Data center cooling demand tailwinds — Climate Solutions segment +51% Q3 FY2026. Pre-earnings anticipatory buying likely.
- Earnings: **2026-05-26 BMO** — MUST EXIT by 2026-05-21 (3-day gate). Add to monitoring.
- Stop: Placed retroactive protective stop at midday: $255.83 trigger / $250.97 limit (2×ATR $16.19 from entry).
- Trail promotion triggers at +2% ($293.97). Watch for continuation.
- Analyst target ~$212–$224 appears stale vs current $291 price. Breakout strategy agnostic to stale targets.
