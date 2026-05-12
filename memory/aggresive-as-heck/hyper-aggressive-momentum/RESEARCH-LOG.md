## 2026-05-12 — Pre-market Research

### Account
- Effective equity: $10,000 (soft allocation, BOT_ALLOCATION=10000)
- Positions: 0/8
- Drawdown: N/A (no prior baseline in BENCHMARK.md)
- Week trades: 0/3

### Market Context
- US-China trade deal framework; Trump-Xi summit May 14-15
- WMT earnings pre-market; CPI today
- VIX below 25 — normal risk-on regime

### Strategy Assessment
Hyper-aggressive-momentum requires:
- 5m candle breakout above prior 15m high with volume ≥ 2× 20-bar average
- EMA(9) > EMA(21) on 5m; RSI(7) between 55–80 on 5m
- NO overnight holds (close all positions at session end)

These signals require real-time intraday monitoring of 5m candle data — unavailable in this batch market-open routine. Cannot confirm valid entry signals for any ticker.

### Trade Ideas Screened
- US-China deal movers (AMD, QCOM, semis, rare earths) — cannot confirm 5m signal from batch
- Pre-market movers undetermined without live 5m tape

### Decision
**NO TRADES.** Intraday momentum signals (5m candle breakout + volume + EMA/RSI confirmation) cannot be validated from a batch routine. Will reassess if intraday scan routine is configured with real-time 5m data access.
