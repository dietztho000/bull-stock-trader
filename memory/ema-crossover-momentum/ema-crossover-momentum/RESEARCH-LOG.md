# Research Log — ema-crossover-momentum / ema-crossover-momentum

Daily pre-market research entries. Most recent entry at bottom.

---

## 2026-05-12 — Pre-market Research

### Account (paper-main, shared)
- Equity: $102,321.37 | Cash: $22,854.05 | Buying power: $125,175.42
- Bot allocation: $10,000 | Bot positions: 0 (none opened yet)
- Shared positions: AMKR, BA, GOOGL, NVDA, XOM (managed by paper/default)

### Strategy Knobs Active
- EMA_FAST=10d / EMA_SLOW=50d | ADX_PERIOD=14d, ADX_THRESHOLD=25
- TIMEFRAME=1d | STOP_TRIGGER=−7% / STOP_LIMIT=−8.5%
- TRAIL_PROMOTION=+10% | EARNINGS_GATE_DAYS=3 | MAX_OPEN=6

### Market Context
- WTI: $101.16 / Brent: $106.83 (+2.5%) | S&P futures: 7,434 (−0.03%)
- VIX: 18.93 — rising; CPI at 8:30 ET
- Sector momentum: Energy, Materials, Industrials leading on 1d charts

### EMA Crossover Candidates (qualitative, pre-CPI)
1. **MU (Micron)** — +15.49% gap; EMA10/50 bullish cross likely; ADX should be >25 (strong trend). EARNINGS_GATE check: >3 days to MU earnings (next is likely July/August). IT sector: 0/3 bot positions. Monitor ADX confirmation at open.
2. **INTC (Intel)** — 52-week breakout; bullish EMA cross likely. Same IT sector as MU; max 1 of the two.
3. **OXY or CVX** — Energy sector EMA10 > EMA50 likely given sector strength; XOM not managed by this bot.

### Risk Factors
- CPI at 8:30 ET — gap risk pre-data
- EARNINGS_GATE_DAYS=3: NVDA May 20 is 8 calendar days away → OK; others clear
- ADX must be confirmed ≥25 at open on 1d bars

### Decision
HOLD pre-CPI — formal EMA/ADX confirmation required at market open. MU and INTC are top candidates if CPI doesn't trigger broad sell-off. Evaluate at 9:30.
