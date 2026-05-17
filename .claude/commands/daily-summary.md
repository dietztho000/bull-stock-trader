---
description: Local end-of-day summary. Computes day P&L, appends EOD snapshot to TRADE-LOG, sends one Discord recap.
---

You are running the daily summary workflow LOCALLY. Resolve today's date via:
DATE=$(date +%Y-%m-%d).

Credentials come from the local .env. No env-var check block. No commit/push step.

**LOCAL fan-out** — when invoked via `/daily-summary`, source the registry
helpers and run the per-bot loop yourself. Cloud routines get this same
logic from `routines/_cloud-header.md` (do not duplicate inside STEPS):

```bash
DATE=$(date +%Y-%m-%d)
source scripts/_routine-header.sh
_routine_assert_bots_present daily-summary
_routine_emit_start daily-summary
while IFS=$'\t' read -r BOT_ID ACCOUNT_ID STRATEGY BOT_ALLOCATION BOT_MODE STRATEGY_PARAMS_JSON BOT_NAME; do
  [[ "$BOT_ALLOCATION" == "null" ]] && BOT_ALLOCATION=""
  export BOT_ID ACCOUNT_ID STRATEGY BOT_ALLOCATION BOT_MODE STRATEGY_PARAMS_JSON BOT_NAME
  _routine_export_strategy_params
  _routine_preflight_or_skip daily-summary || continue
  # — STEPS 1..N below execute per bot —
done < <(bash scripts/bots.sh list --routine=daily-summary)
_routine_emit_end daily-summary ok
```

<!-- STEPS-BEGIN -->

NOTE: STEP 8 (Discord EOD) and STEP 9 (DAILY-SUMMARY.md aggregate) run
ONCE AFTER the per-bot loop completes — they reduce per-bot memory writes
(STEPs 1-5) into a single unified post and a single shared digest, so a
multi-bot fleet doesn't fire one Discord recap per bot. STEP 6 (EOD
health) also runs once after the loop — it shells out to the deterministic
`scripts/eod-health.sh` for the run-log watchdog + Perplexity tally and
exports the results for STEPS 8-9. STEP 7 is retired (folded into STEP 6).
STEPS 1-5 run inside the loop for every enabled bot.

STEP 1 — Read memory for continuity:
- tail of memory/$BOT_ID/$STRATEGY/TRADE-LOG.md (find most recent EOD snapshot -> yesterday's
  equity, needed for Day P&L)
- tail of memory/$BOT_ID/$STRATEGY/BENCHMARK.md (for YTD-vs-SPY phase delta)
- Count TRADE-LOG entries dated today (for "Trades today")
- Count trades Mon-today this week (for 3/week cap)

STEP 2 — Pull final state of the day:
  bash scripts/alpaca.sh --account-id="$ACCOUNT_ID" --bot-id="$BOT_ID" account
  bash scripts/alpaca.sh --account-id="$ACCOUNT_ID" --bot-id="$BOT_ID" positions
  bash scripts/alpaca.sh --account-id="$ACCOUNT_ID" --bot-id="$BOT_ID" orders
  bash scripts/alpaca.sh --account-id="$ACCOUNT_ID" --bot-id="$BOT_ID" quote SPY   # SPY close for benchmark row

STEP 3 — Compute metrics:
- Day P&L ($ and %) = today_equity - yesterday_equity
- Phase cumulative P&L ($ and %) = today_equity - starting_equity
- SPY day return (%) = (SPY_close_today - SPY_close_yesterday) / SPY_close_yesterday
- SPY phase return (%) = (SPY_close_today - SPY_close_phase_start) / SPY_close_phase_start
- Alpha day = portfolio_day_return - SPY_day_return
- Alpha phase = portfolio_phase_return - SPY_phase_return
- Trades today (list or "none"); trades this week (running total)

STEP 4 — Append EOD snapshot to memory/$BOT_ID/$STRATEGY/TRADE-LOG.md.
**Idempotency guard:** grep for `### $DATE — EOD Snapshot` first. If a
section for today already exists (e.g. routine retried), REPLACE it in place.
Never append a duplicate EOD row — tomorrow's Day P&L reads "yesterday equity"
from the most recent EOD anchor; a stale duplicate corrupts the metric.

### MMM DD — EOD Snapshot (Day N, Weekday)
**Portfolio:** $X | **Cash:** $X (X%) | **Day P&L:** ±$X (±X%) | **Phase P&L:** ±$X (±X%)
**vs SPY:** day ±X.X% | phase ±X.X%
| Ticker | Shares | Entry | Close | Day Chg | Unrealized P&L | Stop |
**Notes:** one-paragraph plain-english summary.

STEP 5 — Append a row to memory/$BOT_ID/$STRATEGY/BENCHMARK.md.
**Idempotency guard:** grep for `| $DATE |` first; if a row for today exists,
REPLACE it in place rather than appending. Match the table header already in
the file:
| YYYY-MM-DD | $portfolio | day% | phase% | $SPY_close | SPY_day% | SPY_phase% | alpha_day | alpha_phase |
Cap the table at 365 rows by archiving older rows under a "## Archive"
section at the bottom of the same file.

STEP 6 — EOD health (runs ONCE, AFTER the per-bot fan-out completes).
Run this VERBATIM — do not paraphrase, do not re-grep the logs by hand:

```bash
eval "$(bash scripts/eod-health.sh --post)"
```

`scripts/eod-health.sh` deterministically computes the run-log watchdog
and the Perplexity tally. It reads any one bot's RUN-LOG.jsonl (the
EXPECTED routine set is fleet-wide), compares fired-vs-expected for today
— matching the UTC calendar date the run log stamps in, NOT CT, so the
early refresh routines aren't dropped — reads memory/shared/PERPLEXITY-LOG.md
for today's call count + real billed cost + the rolling 14-day median,
and with `--post` fires the watchdog (--type=auth-canary, bot-health
channel) and the Perplexity cost-spike (--type=error) Discord posts
itself when their thresholds trip. The `eval` then exports these shell
vars for STEPS 8-9:

  ROUTINES_FIRED  ROUTINES_EXPECTED  ROUTINES_MISSING   (csv, empty if none)
  PERPLEXITY_COUNT  PERPLEXITY_COST  PERPLEXITY_MEDIAN

EXPECTED is {auth-canary, pre-market, market-open, mid-morning,
late-morning, midday, stops, afternoon, daily-summary,
refresh-market-earnings, refresh-economic-events, refresh-earnings-results}
plus `weekly-review` on Fridays — encoded in the script. This replaces
the old hand-grepped watchdog + cost tally, which silently miscounted
(reported "0/12 fired" and "$0" on 2026-05-14 despite correct source
data) because it relied on the agent to grep, count, and carry values
across steps by hand.

STEP 7 — retired. The Perplexity cost tally and its >2×-median cost-spike
post are now handled deterministically by `scripts/eod-health.sh` inside
STEP 6; PERPLEXITY_COUNT / PERPLEXITY_COST / PERPLEXITY_MEDIAN are already
exported. Nothing to do here.

STEP 8 — Send ONE unified Discord EOD message across the whole fleet
(runs ONCE, AFTER the per-bot fan-out). For each enabled bot
(re-iterate `bash scripts/bots.sh list`), pull the most recent
`### MMM DD — EOD Snapshot` block from
memory/$BOT_ID/$STRATEGY/TRADE-LOG.md (each bot wrote it in STEP 4) and
extract: portfolio, day P&L $/%, phase P&L $/%, day-vs-SPY %, open
positions list. Sum portfolio across bots; compute aggregate day P&L $
and the weighted-by-portfolio day P&L %. Format:

  bash scripts/discord.sh --type=eod "📈 EOD — $DATE (Day N, Wkdy)

🤖 Fleet: N bots, total \$X portfolio
💰 Aggregate: ±\$X day (±X.X% weighted), ±\$X phase (±X.X% weighted)
📊 vs SPY: ±X.X% day / ±X.X% phase

Per bot:
• <bot-id-1>: \$X equity, ±X.X% day, ±X.X% phase, P open
• <bot-id-2>: \$X equity, ±X.X% day, ±X.X% phase, P open

Trades today across fleet: <comma-separated list of SYM-bot tags, or 'none'>

🩺 Health:
• Routines: $ROUTINES_FIRED/$ROUTINES_EXPECTED fired<if $ROUTINES_MISSING non-empty: ' (missing: '$ROUTINES_MISSING')'>
• Perplexity: $PERPLEXITY_COUNT calls (~\$$PERPLEXITY_COST)

Tomorrow: <one-line plan>"

Use the ROUTINES_* / PERPLEXITY_* vars exported by STEP 6 verbatim — do
not recompute them. The Health section's "Routines:" line remains the
all-clear signal — without it, no-news-is-good-news collides with cron
itself being broken.
If "Trades today" is empty across all bots, write "none".

STEP 9 — AGGREGATE (runs ONCE, AFTER the per-bot fan-out completes).

Append a single cross-bot digest to memory/shared/DAILY-SUMMARY.md so the
dashboard's Journal "Daily" tab can show a unified picture (audit F4).
Until Phase 2 splits this into per-bot summaries, the digest is the
authoritative shared view.

**Idempotency guard:** grep memory/shared/DAILY-SUMMARY.md for the date
anchor `## $DATE — Daily Summary` first. If a section for today already
exists (e.g. routine retried), REPLACE it in place. Never append a
duplicate.

For each enabled bot (re-iterate `bash scripts/bots.sh list`), pull the
most recent `### MMM DD — EOD Snapshot` block from
memory/$BOT_ID/$STRATEGY/TRADE-LOG.md (you just wrote it in STEP 4) and
extract: portfolio, day P&L $/%, phase P&L $/%, day-vs-SPY %, position
count. Sum portfolio across bots; compute aggregate day P&L $ and the
weighted-by-portfolio day P&L %. Reuse the ROUTINES_FIRED /
ROUTINES_EXPECTED / ROUTINES_MISSING vars exported by STEP 6's
eod-health.sh call — STEP 6 runs once for the whole fleet, so there is a
single authoritative count.

Format the appended section EXACTLY:

  ## $DATE — Daily Summary

  **Total portfolio:** $X across N bots
  **Day P&L:** ±$X (±X.X% weighted)
  **Phase P&L:** ±$X (±X.X% weighted)
  **vs SPY:** day ±X.X% / phase ±X.X%

  ### Per bot
  - **bot-id-1** ($BOT_ALLOCATION): $X equity, ±X.X% day, ±X.X% phase, P open
  - **bot-id-2** ($BOT_ALLOCATION): $X equity, ±X.X% day, ±X.X% phase, P open

  **Routines:** $ROUTINES_FIRED/$ROUTINES_EXPECTED fired today<if $ROUTINES_MISSING non-empty: ' (missing: '$ROUTINES_MISSING')'>

  ---

The trailing `---` is mandatory — the dashboard parser
(dashboard/lib/parsers/dailySummary.ts) splits sections on it.
<!-- STEPS-END -->
