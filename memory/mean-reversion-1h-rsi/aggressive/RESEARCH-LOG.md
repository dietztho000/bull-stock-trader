# Research Log — mean-reversion-1h-rsi / aggressive

Daily pre-market research entries. Most recent entry at bottom.

---

## 2026-05-12 — Pre-market Research

### Account (paper-main, shared)
- Equity: $102,321.37 | Cash: $22,854.05 | Buying power: $125,175.42
- Bot allocation: $10,000 | Bot positions: 0 (none opened yet)
- Shared positions: AMKR, BA, GOOGL, NVDA, XOM (managed by paper/default)

### Strategy Knobs Active
- RSI_PERIOD=14 (1h bars) | RSI_OVERSOLD=30 | MA_TREND_PERIOD=200d
- MAX_HOLD_DAYS=2 | STOP_TRIGGER=−4% / STOP_LIMIT=−5%
- TAKE_PROFIT=+6% (sell half) then 3% trail | EARNINGS_GATE=2d | MAX_OPEN=5

### Market Context
- WTI: $101.16 / Brent: $106.83 (+2.5%) | S&P futures: 7,434 (−0.03%)
- VIX: 18.93 — elevated; **CPI April 2026 at 8:30 ET** = primary setup generator
- Hot CPI → sell-off → 1h RSI oversold (<30) in quality uptrending names = entry signal

### Watch List (pending CPI post-8:30)
1. **GOOGL** — above 200d MA, uptrend; 1h RSI could hit <30 on CPI spike sell-off
2. **NVDA** — above 200d MA; strong uptrend; 1h RSI watch post-CPI (earnings May 20 = 8d → OK for 2d hold)
3. **XOM** — above 200d MA; oil spike provides floor; 1h RSI watch if equity weakness decouples from oil

### Risk Factors
- CPI cool print → no oversold RSI = no entry signal today
- VIX 18.93 → wider bars; −4% stop can trigger on normal CPI-day noise
- MAX_HOLD=2 days: any entry today must resolve by May 14

### Decision
HOLD pre-CPI — monitor 1h RSI on quality names after 8:30 ET release. No pre-data entries. Primary opportunity: hot CPI sell-off creates oversold 1h RSI entry in GOOGL, NVDA, or XOM after 9:30 open.
