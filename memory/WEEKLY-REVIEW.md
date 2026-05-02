# Weekly Review

Friday reviews appended here.
Template for each entry:

## Week ending YYYY-MM-DD

### Stats
| Metric             | Value              |
|--------------------|--------------------|
| Starting portfolio | $X                 |
| Ending portfolio   | $X                 |
| Week return        | ±$X (±X%)          |
| S&P 500 week       | ±X%                |
| Bot vs S&P         | ±X%                |
| Trades             | N (W:X / L:Y / open:Z) |
| Win rate           | X%                 |
| Best trade         | SYM +X%            |
| Worst trade        | SYM -X%            |
| Profit factor      | X.XX               |

### Closed Trades
| Ticker | Entry | Exit | P&L | Notes |

### Open Positions at Week End
| Ticker | Entry | Close | Unrealized | Stop |

### What Worked
- ...

### What Didn't Work
- ...

### Key Lessons
- ...

### Adjustments for Next Week
- ...

### Overall Grade: X

---

## Week ending 2026-05-01

> **Note:** Partial first week — bot launched 2026-04-29; live trading began 2026-04-30 (Thu). Only 2 trading days in scope.

### Stats
| Metric             | Value                        |
|--------------------|------------------------------|
| Starting portfolio | $100,000.00 (launch baseline)|
| Ending portfolio   | $99,465.71                   |
| Week return        | -$534.29 (-0.53%)            |
| S&P 500 week       | +3.94% (SPY $693.23 → $720.55)|
| Bot vs S&P         | -4.47%                       |
| Trades             | 3 (W:0 / L:0 / open:3)       |
| Win rate           | N/A (no closed trades)       |
| Best trade         | AMKR +3.47% unrealized       |
| Worst trade        | NVDA -5.21% unrealized       |
| Profit factor      | N/A (no closed trades)       |

**Alpha sparkline (7-day, 2 data points):** `─ ─ ─ ─ ─ ▆ ▁`
- 2026-04-30: alpha_phase = -0.35% ▆
- 2026-05-01: alpha_phase = -4.47% ▁

### Closed Trades
| Ticker | Entry | Exit | P&L | Notes |
|--------|-------|------|-----|-------|
| — | — | — | — | No closed trades this week |

### Open Positions at Week End
| Ticker | Entry   | Close   | Unrealized P&L      | Stop    |
|--------|---------|---------|---------------------|---------|
| AMKR   | $68.14  | $70.51  | +$520.63 (+3.47%)   | $63.03  |
| NVDA   | $209.24 | $198.34 | -$1,035.72 (-5.21%) | $181.80 |
| XOM    | $152.51 | $152.35 | -$19.20 (-0.10%)    | $140.12 |

### Sector Ledger Summary
| Sector               | Open Positions | Closed Trades | Status       |
|----------------------|----------------|---------------|--------------|
| Technology (Semi)    | AMKR, NVDA     | 0             | OPEN (clean) |
| Energy               | XOM            | 0             | OPEN (clean) |

No sectors near block (need 2 consecutive losses). No sector at 1-loss streak this week.

### Entry Scorer Audit
No entry_scorer blocks logged in TRADE-LOG.md for the 3 initial positions — they were entered during launch setup before the scorer rubric was embedded in the market-open workflow. **Gap:** all future buys must include the JSON scorer block. Can't correlate score → outcome this week.

### What Worked
- AMKR seized semiconductor packaging momentum; +3.47% in 2 days vs flat market tone
- XOM held near flat (-0.10%) despite oil macro noise — energy position stable
- Conservative deployment (53%) left dry powder; avoids overcommitting on launch day
- Stop placement: all 3 positions have GTC 10% trailing stops in place from day 1
- Bot infrastructure (routines, scripts, logging) validated end-to-end on first real day

### What Didn't Work
- NVDA -5.21% on a week when SPY ripped +3.94% — AI rally benefited NVDA peers more
- Deployment at 53% vs 75-85% target; GOOGL and QCOM identified but not bought (market closed when pre-market routine ran)
- No entry_scorer blocks on initial positions — audit trail gap
- PDT count was at limit (3) on Apr 30, constraining same-day flexibility
- Alpha severely negative (-4.47%) — market gap-up on AI earnings we weren't positioned for

### Key Lessons
- Pre-market research must fire BEFORE market open or flag "market open — execute now" vs "market closed — defer"
- Entry scorer must be logged BEFORE every buy, including at bot launch
- SPY ripping on AI earnings (GOOGL/AMZN/QCOM beats) while we held NVDA and missed GOOGL/QCOM = poor sector allocation for the catalyst at hand
- NVDA now within 2.0% of -7% cut threshold ($194.49); needs active monitoring Monday AM
- Two strong candidates (GOOGL, QCOM) ready for next week to close the deployment gap

### Adjustments for Next Week
- Priority: deploy $25-30K additional capital (2 positions) — target GOOGL and/or QCOM if entry scorer ≥ 7
- NVDA watch: if opens below $194.49, cut immediately; do not hesitate
- Ensure entry_scorer block is logged in TRADE-LOG.md for every new buy
- Re-run pre-market at actual market open time if first run catches closed market
- Max 3 new trades this week; with 3 open positions, can add 2-3 more (up to 5-6 cap)

### Overall Grade: C
*First partial week (2 days). Bot operational, infrastructure solid. But -4.47% alpha on a +3.94% SPY week is bad. NVDA drag + missed GOOGL/QCOM rally = wrong positioning for the catalyst. No rule violations. Deployment gap is the main fix for week 2.*
