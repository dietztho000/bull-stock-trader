---
description: Local end-of-day summary. Computes day P&L, appends EOD snapshot to TRADE-LOG, sends one Discord recap.
---

You are running the daily summary workflow LOCALLY. Resolve today's date via:
DATE=$(date +%Y-%m-%d).

Credentials come from the local .env. No env-var check block. No commit/push step.

<!-- STEPS-BEGIN -->
STEP 1 — Read memory for continuity:
- tail of memory/TRADE-LOG.md (find most recent EOD snapshot -> yesterday's
  equity, needed for Day P&L)
- tail of memory/BENCHMARK.md (for YTD-vs-SPY phase delta)
- Count TRADE-LOG entries dated today (for "Trades today")
- Count trades Mon-today this week (for 3/week cap)

STEP 2 — Pull final state of the day:
  bash scripts/alpaca.sh account
  bash scripts/alpaca.sh positions
  bash scripts/alpaca.sh orders
  bash scripts/alpaca.sh quote SPY   # SPY close for benchmark row

STEP 3 — Compute metrics:
- Day P&L ($ and %) = today_equity - yesterday_equity
- Phase cumulative P&L ($ and %) = today_equity - starting_equity
- SPY day return (%) = (SPY_close_today - SPY_close_yesterday) / SPY_close_yesterday
- SPY phase return (%) = (SPY_close_today - SPY_close_phase_start) / SPY_close_phase_start
- Alpha day = portfolio_day_return - SPY_day_return
- Alpha phase = portfolio_phase_return - SPY_phase_return
- Trades today (list or "none"); trades this week (running total)

STEP 4 — Append EOD snapshot to memory/TRADE-LOG.md.
**Idempotency guard:** grep for `### $DATE — EOD Snapshot` first. If a
section for today already exists (e.g. routine retried), REPLACE it in place.
Never append a duplicate EOD row — tomorrow's Day P&L reads "yesterday equity"
from the most recent EOD anchor; a stale duplicate corrupts the metric.

### MMM DD — EOD Snapshot (Day N, Weekday)
**Portfolio:** $X | **Cash:** $X (X%) | **Day P&L:** ±$X (±X%) | **Phase P&L:** ±$X (±X%)
**vs SPY:** day ±X.X% | phase ±X.X%
| Ticker | Shares | Entry | Close | Day Chg | Unrealized P&L | Stop |
**Notes:** one-paragraph plain-english summary.

STEP 5 — Append a row to memory/BENCHMARK.md.
**Idempotency guard:** grep for `| $DATE |` first; if a row for today exists,
REPLACE it in place rather than appending. Match the table header already in
the file:
| YYYY-MM-DD | $portfolio | day% | phase% | $SPY_close | SPY_day% | SPY_phase% | alpha_day | alpha_phase |
Cap the table at 365 rows by archiving older rows under a "## Archive"
section at the bottom of the same file.

STEP 6 — Run-log watchdog. Read memory/RUN-LOG.jsonl and assert that
every routine that SHOULD have fired today produced at least one
{"action":"end","status":"ok"} line:
  - auth-canary, pre-market, market-open, midday, stops, daily-summary
    (all weekdays)
  - weekly-review (Fridays only)
For each missing routine, build a one-line warning. If anything is
missing, fire `bash scripts/discord.sh --type=error "watchdog $DATE:
missing routines: <list>"` BEFORE the EOD post. This catches silent
no-ops that look identical to legitimate quiet days.

STEP 7 — Perplexity cost tally. Read memory/PERPLEXITY-LOG.md and count
rows whose timestamp starts with $DATE. Estimate cost as
(count * $0.0005). Compute the rolling 14-day median count from prior
days' rows; if today's count > 2x that median, fire
`bash scripts/discord.sh --type=error "perplexity $DATE: $COUNT calls
(2x rolling median $MEDIAN — possible prompt regression)"`.

STEP 8 — Send ONE Discord message (always, even on no-trade days). <= 15 lines:
  bash scripts/discord.sh --type=eod "EOD MMM DD
  Portfolio: \$X (±X% day, ±X% phase)
  vs SPY: ±X% day / ±X% phase
  Cash: \$X
  Trades today: <list or none>
  Open positions:
    SYM ±X.X% (stop \$X.XX)
  Perplexity: N calls (~\$X.XX)
  Tomorrow: <one-line plan>"
<!-- STEPS-END -->
