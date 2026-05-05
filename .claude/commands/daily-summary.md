---
description: Local end-of-day summary. Computes day P&L, appends EOD snapshot to TRADE-LOG, sends one Discord recap.
---

You are running the daily summary workflow LOCALLY. Resolve today's date via:
DATE=$(date +%Y-%m-%d).

Credentials come from the local .env. No env-var check block. No commit/push step.

<!-- STEPS-BEGIN -->

PER-BOT FAN-OUT — every numbered STEP below runs ONCE PER ENABLED BOT.
Read the registry first:

  if [[ "$(bash scripts/bots.sh count)" == "0" ]]; then
    bash scripts/discord.sh --type=error "No enabled bots in registry — aborting daily-summary"
    exit 0
  fi

  while IFS=$'	' read -r BOT_ID ACCOUNT_ID STRATEGY BOT_ALLOCATION BOT_MODE; do
    export BOT_ID ACCOUNT_ID STRATEGY BOT_ALLOCATION BOT_MODE
    bash scripts/auth-preflight.sh daily-summary --account-id="$ACCOUNT_ID" || continue
    # ─── run STEPS 1..N below for this bot ────────────────────────────
  done < <(bash scripts/bots.sh list --routine=daily-summary)

Everything beneath this preamble runs inside that loop. $BOT_ID,
$ACCOUNT_ID, $STRATEGY, $BOT_ALLOCATION, $BOT_MODE are guaranteed set.
Memory paths use $BOT_ID/$STRATEGY. Every alpaca.sh call already
includes --account-id="$ACCOUNT_ID" --bot-id="$BOT_ID".

NOTE: pre-market does Perplexity research that is conceptually shared
across bots. The grep-first idempotency rule on PERPLEXITY-LOG.md means
the 2nd, 3rd, … bot iterations will skip the duplicate Perplexity call
when today's answer is already cached. daily-summary now posts a SINGLE
unified Discord recap across all bots (STEP 8 runs once after the
fan-out, audit Phase 2). Per-bot memory writes (STEPs 1-5) still happen
inside the loop. Watchdog and perplexity-tally alerts (STEPs 6, 7) also
moved out of the loop so a 3-bot fleet doesn't trigger 3 identical
Discord alerts.

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

STEP 6 — Run-log watchdog (runs ONCE, AFTER the per-bot fan-out
completes). Pick any one bot's memory/$BOT_ID/$STRATEGY/RUN-LOG.jsonl —
the EXPECTED routine set is fleet-wide (the same routines fire for every
bot), so reading any single bot's run log is sufficient to compute
fired-vs-expected. Stash both counts (|FIRED| / |EXPECTED|) for STEP 8.
  EXPECTED = {auth-canary, pre-market, market-open, mid-morning, late-morning,
              midday, stops, afternoon, daily-summary}
            (all weekdays; add `weekly-review` to EXPECTED on Fridays)
  FIRED    = set of routines with at least one {"action":"end","status":"ok"}
            row whose timestamp starts with $DATE
  MISSING  = EXPECTED - FIRED

If MISSING is non-empty, fire BEFORE the EOD post (preserve format):
  bash scripts/discord.sh --type=auth-canary "⚠️ Watchdog — $DATE

Missing routines: <comma-separated list>
Fired routines: <comma-separated list>

Action: check the cloud Routines UI run logs for the missing ones."

This goes to the auth-canary (bot-health) channel so it sits alongside
the morning auth checks instead of mixing with in-flight workflow errors.
This catches silent no-ops that look identical to legitimate quiet days.

STEP 7 — Perplexity cost tally (runs ONCE, AFTER the per-bot fan-out).
Read memory/shared/PERPLEXITY-LOG.md and count rows whose timestamp
starts with $DATE. Estimate cost as (count * $0.0005). Compute the
rolling 14-day median count from prior days' rows. Stash COUNT, COST,
MEDIAN for STEP 8's EOD post.
If today's count > 2x median, ALSO fire (preserve format):
  bash scripts/discord.sh --type=error "⚠️ Perplexity cost spike — $DATE

Calls today: $COUNT (~\$$COST)
Rolling 14-day median: $MEDIAN
Threshold: >2× median

Possible prompt regression — check today's RESEARCH-LOG and routine logs."

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
• Routines: N/M fired<if MISSING non-empty: ' (missing: <list>)'>
• Perplexity: N calls (~\$X.XX)

Tomorrow: <one-line plan>"

The Health section's "Routines:" line remains the all-clear signal —
without it, no-news-is-good-news collides with cron itself being broken.
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
weighted-by-portfolio day P&L %. Reuse the routine watchdog's |FIRED|
/ |EXPECTED| count from STEP 6 — if multiple bots ran STEP 6, take the
worst (lowest fired ratio) since any single missing routine indicates
a scheduler hiccup affecting the whole fleet.

Format the appended section EXACTLY:

  ## $DATE — Daily Summary

  **Total portfolio:** $X across N bots
  **Day P&L:** ±$X (±X.X% weighted)
  **Phase P&L:** ±$X (±X.X% weighted)
  **vs SPY:** day ±X.X% / phase ±X.X%

  ### Per bot
  - **bot-id-1** ($BOT_ALLOCATION): $X equity, ±X.X% day, ±X.X% phase, P open
  - **bot-id-2** ($BOT_ALLOCATION): $X equity, ±X.X% day, ±X.X% phase, P open

  **Routines:** N/M fired today<if MISSING non-empty: ' (missing: <list>)'>

  ---

The trailing `---` is mandatory — the dashboard parser
(dashboard/lib/parsers/dailySummary.ts) splits sections on it.
<!-- STEPS-END -->
