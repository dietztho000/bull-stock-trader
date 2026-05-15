# Weekly Review — EMA Crossover Momentum

---

## Week ending 2026-05-15

### Week Stats

| Metric | Value |
|---|---|
| Start equity (inception Wed 2026-05-13) | $10,000.00 |
| End equity (Fri) | $9,957.61 |
| Week return (partial — 3 trading days) | −$42.39 / −0.42% |
| SPY week | +0.54% |
| Alpha (week) | −0.96% |
| Trades (W/L/open) | 1 (W:0 / L:0 / open:1) |
| Win rate | N/A (no closed trades) |
| Profit factor | N/A |
| Best trade | N/A (no closed) |
| Worst trade | HWM −5.15% unrealized |
| Alpha sparkline | — (no benchmark history yet) |

**Note:** Account created 2026-05-13 (Tuesday). Only 3 trading days of history.

### Closed Trades
No closed trades this week.

### Open Positions at Week End

| Symbol | Shares | Avg Entry | Current | Unrealized P&L | Unrealized % | Stop Level |
|---|---|---|---|---|---|---|
| HWM | 3 | $274.48 | $260.35 | −$42.39 | −5.15% | $255.27 (−7%) |

**HWM stop buffer:** $260.35 current vs $255.27 stop trigger — 1.95% cushion remaining. Watch closely.

### Sector Ledger Summary
No sector ledger data yet (new bot). HWM = Industrials (Howmet Aerospace). No prior trades in sector.

### Entry-Scorer Audit
One trade placed (HWM). Score unknown from log. No comparison cohort — audit deferred until Week 2.

### What Worked
- Bot is executing: capital deployed within first 2 days of inception.
- EMA crossover + ADX filter produced at least one signal.

### What Didn't Work
- HWM entered at $274.48, now −5.15% — entering a position that immediately moved against the trade.
- Only 8% of equity deployed ($781/$9,957). Strategy targets 80–100% deployed; significantly under.
- Losing alpha vs SPY in first partial week.

### Key Lessons
- First entry (HWM) came in weak — either the EMA golden cross was at an extended level, or broader tape turned against industrials post-entry.
- Low capital deployment suggests few qualifying signals despite strategy targeting 6 max positions.

### Adjustments for Next Week
- Monitor HWM stop closely — at $255.27, a further 1.95% decline triggers the -7% stop-limit GTC.
- Continue scanning for EMA golden cross setups to bring deployment up toward 80% target.
- If HWM stops out, log sector outcome in SECTOR-LEDGER.md (Industrials: 0W/1L).

### Grade: C−
Partial first week. Bot executed (positive), but HWM is immediately underwater near stop territory. Alpha negative vs SPY. Execution quality needs validation over a full week.
