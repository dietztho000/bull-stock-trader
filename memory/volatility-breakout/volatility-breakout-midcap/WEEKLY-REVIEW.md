# Weekly Review — Volatility Breakout Mid-Cap

---

## Week ending 2026-05-15

### Week Stats

| Metric | Value |
|---|---|
| Start equity (inception Wed 2026-05-13) | $10,000.00 |
| End equity (Fri) | $9,949.15 |
| Week return (partial — 3 trading days) | −$50.85 / −0.51% |
| SPY week | +0.54% |
| Alpha (week) | −1.05% |
| Trades (W/L/open) | 1 (W:0 / L:0 / open:1) |
| Win rate | N/A (no closed trades) |
| Profit factor | N/A |
| Best trade | N/A (no closed) |
| Worst trade | MOD −5.88% unrealized |
| Alpha sparkline | — (no benchmark history yet) |

**Note:** Account created 2026-05-13 (Tuesday). Only 3 trading days of history.

### Closed Trades
No closed trades this week.

### Open Positions at Week End

| Symbol | Shares | Avg Entry | Current | Unrealized P&L | Unrealized % | Stop Basis |
|---|---|---|---|---|---|---|
| MOD | 3 | $288.21 | $271.26 | −$50.85 | −5.88% | 2× ATR below entry |

**MOD risk note:** At −5.88% from entry, approaching the 2× ATR hard stop. ATR(14) at entry determines exact trigger. Verify stop-limit GTC is active and correctly placed.

### Sector Ledger Summary
No sector ledger data yet (new bot). MOD = Industrials (Modine Manufacturing). No prior trades in sector.

### Entry-Scorer Audit
One trade placed (MOD). Score not recorded in log. No comparison cohort — audit deferred until Week 2.

### What Worked
- Bot is executing: 20-day breakout + 1.5× volume surge filter triggered and deployed capital.
- ATR-based position sizing methodology is sound — 1% equity risk per position limits max drawdown per trade.

### What Didn't Work
- MOD entered on a 20-day breakout and immediately reversed — classic false breakout / failed breakout scenario.
- At −5.88%, significantly worse performance than SPY +0.54% this week.
- Only ~8% of equity deployed ($813/$9,949). Strategy max is 4 positions; well under target.
- Stop-loss has not been recorded in TRADE-LOG (empty) — verify GTC stop-limit is live on Alpaca.

### Key Lessons
- False breakouts are the primary risk of breakout strategies; volume surge filter (1.5×) may be insufficient to distinguish genuine from false breaks.
- Entry on a breakout that immediately reverses -5.88% suggests either broader sector/macro headwind or breakout was at resistance rather than a clean level.
- ATR-based stop is appropriate but confirm it's actually placed — TRADE-LOG is empty which is a data gap.

### Adjustments for Next Week
- CRITICAL: Verify MOD stop-limit GTC order is active on Alpaca. If not, place immediately.
- If MOD stops out, record in SECTOR-LEDGER.md (Industrials: 0W/1L).
- Consider raising VOLUME_SURGE_MULTIPLE from 1.5× to 2× to filter weaker breakout signals.
- Continue scanning for 20-day high breakouts with genuine volume conviction.

### Grade: C−
Partial first week. Bot fired one trade (positive), but MOD is in false-breakout territory at −5.88%. Alpha significantly negative vs SPY. Key near-term risk: confirm ATR stop order is live.
