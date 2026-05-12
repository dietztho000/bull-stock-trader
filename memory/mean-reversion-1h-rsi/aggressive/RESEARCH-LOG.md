## 2026-05-12 — Pre-market Research

### Account
- Effective equity: $10,000 (soft allocation, BOT_ALLOCATION=10000)
- Positions: 0/5
- Drawdown: N/A (no prior baseline in BENCHMARK.md)
- Week trades: 0/3

### Market Context
- US-China trade deal rally; VIX below 25; risk-on
- Market at elevated levels after broad recovery from April lows
- Mean reversion setups less common in strong uptrend environments

### Strategy Requirements
1h RSI(14) crosses UP through 30 from below + price above 200-day MA

### Candidates Screened (daily RSI as proxy)
| Symbol | Daily RSI14 | Direction | Notes |
|--------|-------------|-----------|-------|
| RTX | 36.9 | Recovering | $172→$178, defense sector recovering |
| LMT | 22.6 | Very oversold | But defense sector mixed |
| PFE | 30.1 | Near trigger | Pharma weakness |

RTX daily RSI 36.9 — possible 1h oversold setup, but requires confirmed 1h RSI(14) cross up through 30 (full candle close required by strategy rule 1). Cannot confirm without live 1h candle data in batch routine.

### Decision
**NO TRADES.** Strategy requires confirmed 1h RSI(14) cross up through 30 — cannot verify from daily bar data in batch routine. Nearest candidate RTX (daily RSI 36.9) needs real-time 1h confirmation before entry.
