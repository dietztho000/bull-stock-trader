# Research Log — volatility-breakout / volatility-breakout-midcap

---

## 2026-05-15 — Pre-market Research

### Account snapshot
- Equity: $10,002.37 | Cash: $9,135.37 | BP: $19,137.74
- Open positions: 1 (MOD) | Day P&L: -$9.48 | Daytrade count: 0
- Deployed: ~8.7% ($867.00 long market value)

### Open positions
| Symbol | Shares | Avg Entry | Current | Unreal P&L | % | Stop type | Stop price | HWM |
|--------|--------|-----------|---------|------------|---|-----------|------------|-----|
| MOD | 3 | $288.21 | $289.00 | +$2.37 | +0.27% | Trail 10% | $264.50 | $293.89 |

### Market context
- WTI: ~$102.5/bbl | Brent: ~$107.0/bbl (elevated; Strait of Hormuz risk)
- S&P 500 futures: ~7,516 (-0.13% premarket)
- VIX: ~17.1 (moderate)
- Today's releases: UMich Consumer Sentiment (10AM), SLOOS (2PM); Powell's final day as Fed Chair
- CPI (May 12) and PPI (May 13) already digested
- Key catalysts: AI/tech leadership, data center buildout, energy/geopolitics

### MOD news check
- Modine Manufacturing: AI/data center cooling division growing rapidly, being spun into standalone segment
- Q3 2026 EPS $1.19 vs est $0.99 (+20% beat)
- **⚠️ EARNINGS GATE: Q4 2026 results scheduled May 26, 2026 AMC**
  - EARNINGS_GATE_DAYS = 3 (strategy config)
  - 3 trading days before May 26 = May 21
  - Must be fully exited by close of May 20 (Tuesday)
  - Today is May 15 (Friday) — 3 trading days remain (May 18, 19, 20)
  - **Action: plan forced exit by May 20 EOD; market-open routine will enforce**
- Current trail stop at 10% from HWM $293.89 = $264.50; protecting +$2.37 unrealized

### Sector check
- SECTOR-LEDGER empty — no 2-loss streak blocks
- Industrials sector: 3rd best YTD (+10%) — tail wind intact for MOD

### Trade ideas (new positions — currently at 1/4 max)

1. **DDOG (Datadog)** — reported May 7, +31% post-earnings. AI observability/monitoring platform, data center growth play.
   - Entry: confirm 20-day high breakout with volume > 1.5× avg on daily close
   - Stop: 2× ATR(14) below entry | Target: +2R
   - Catalyst: AI infrastructure spending; strong beat + guide-up; institutional accumulation
   - Score potential: 8/10 — size ~12% of equity
   - Earnings gate: next earnings ~August — well clear of 3-day gate
   - ⚠️ Check: still within 5-day re-entry blackout? DDOG not previously held — clear

2. **OXY (Occidental Petroleum)** — mid-cap energy, WTI >$100 breakout setup
   - Entry: 20-day high breakout with volume surge on daily close
   - Stop: 2× ATR(14) below entry | Target: +2R
   - Catalyst: WTI elevated, AI + carbon capture diversification story
   - Score potential: 7/10 — size ~8%
   - ⚠️ Market cap check: OXY ~$50B — at the ceiling of mid-cap universe; borderline

### Risk factors
- **MOD earnings gate approaching** — forced exit by May 20; do not let it slip
- Gap-up filter: do not enter any position if gap > 5% above prior close
- UMich sentiment 10AM — weak reading = risk-off day, defer all new entries
- Oil reversal risk on Hormuz de-escalation headlines
- MOD trailing stop at $264.50 — if MOD drops to ~$264, stop executes automatically

### Decision: HOLD MOD — earnings gate exit plan in place
- MOD position small (+0.27%), trail stop protecting principal
- Force-exit MOD by close of May 20 (market-open routine handles May 20/21 check)
- New entries (DDOG/OXY): evaluate daily close for breakout confirmation — do not enter premarket
- Default: HOLD unless confirmed breakout signal at/after open
