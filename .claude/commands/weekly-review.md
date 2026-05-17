---
description: Local Friday weekly review. Computes W/L stats, grades the week, updates strategy if a rule has proven out or failed.
---

You are running the Friday weekly review workflow LOCALLY. Resolve today's date via:
DATE=$(date +%Y-%m-%d).

Credentials come from the local .env. No env-var check block. No commit/push step.

**LOCAL fan-out** — when invoked via `/weekly-review`, source the registry
helpers and run the per-bot loop yourself. Cloud routines get this same
logic from `routines/_cloud-header.md` (do not duplicate inside STEPS):

```bash
DATE=$(date +%Y-%m-%d)
source scripts/_routine-header.sh
_routine_assert_bots_present weekly-review
_routine_emit_start weekly-review
while IFS=$'\t' read -r BOT_ID ACCOUNT_ID STRATEGY BOT_ALLOCATION BOT_MODE STRATEGY_PARAMS_JSON BOT_NAME; do
  [[ "$BOT_ALLOCATION" == "null" ]] && BOT_ALLOCATION=""
  export BOT_ID ACCOUNT_ID STRATEGY BOT_ALLOCATION BOT_MODE STRATEGY_PARAMS_JSON BOT_NAME
  _routine_export_strategy_params
  _routine_preflight_or_skip weekly-review || continue
  # — STEPS 1..N below execute per bot —
done < <(bash scripts/bots.sh list --routine=weekly-review)
_routine_emit_end weekly-review ok
```

<!-- STEPS-BEGIN -->

NOTE: STEP 6 stashes a per-bot weekly digest block into the $FLEET_DIGEST
accumulator instead of posting to Discord. STEP 7 runs ONCE, AFTER the
per-bot fan-out loop completes, and sends a single consolidated weekly
recap covering every bot — a multi-bot fleet must never fire one weekly
post per bot. STEPS 1-6 run inside the loop for every enabled bot.

STEP 1 — Read memory for full week context. First, lazily create the
per-run fleet-digest accumulator — `:=` makes this idempotent across the
per-bot loop (first bot creates the temp file, the rest reuse it; it
lives in $TMPDIR, never under memory/, and is removed in STEP 7):

```bash
: "${FLEET_DIGEST:=$(mktemp -t fleet-digest-weekly-review.XXXXXX)}"
export FLEET_DIGEST
```

Then read:
- memory/$BOT_ID/$STRATEGY/WEEKLY-REVIEW.md (match existing template exactly)
- ALL this week's entries in memory/$BOT_ID/$STRATEGY/TRADE-LOG.md
- ALL this week's entries in memory/$BOT_ID/$STRATEGY/RESEARCH-LOG.md
- memory/$BOT_ID/$STRATEGY/BENCHMARK.md (last 7 daily rows for the alpha trend)
- memory/$BOT_ID/$STRATEGY/SECTOR-LEDGER.md (sector rotation health check)
- memory/$BOT_ID/$STRATEGY/TRADING-STRATEGY.md

STEP 2 — Pull week-end state:
  bash scripts/alpaca.sh --account-id="$ACCOUNT_ID" --bot-id="$BOT_ID" account
  bash scripts/alpaca.sh --account-id="$ACCOUNT_ID" --bot-id="$BOT_ID" positions

STEP 3 — Compute the week's metrics:
- Starting portfolio (Monday AM equity)
- Ending portfolio (today's equity)
- Week return ($ and %)
- S&P 500 week return: read from BENCHMARK.md (Monday→Friday SPY closes);
  fall back to perplexity.sh "S&P 500 weekly performance week ending $DATE"
  only if BENCHMARK.md is empty.
- Alpha for the week (portfolio_return - SPY_return)
- Trades taken (W/L/open)
- Win rate (closed trades only)
- Best trade, worst trade
- Profit factor (sum winners / |sum losers|)
- Render a 7-day ASCII sparkline of alpha_phase from BENCHMARK.md

STEP 4 — Append full review section to memory/$BOT_ID/$STRATEGY/WEEKLY-REVIEW.md.
**Idempotency guard:** grep for `## Week ending $DATE` first. If a section
for this week already exists (routine re-fired, or you ran it manually
earlier), REPLACE it in place. Never duplicate a weekly entry.

The review should include:
- Week stats table (include alpha + sparkline)
- Closed trades table
- Open positions at week end
- Sector ledger summary (any sector at 1-loss streak — close to being blocked)
- Entry-scorer audit: do trades with score 8-10 outperform trades with
  score 7? (drives weekly rubric tuning)
- What worked (3-5 bullets)
- What didn't work (3-5 bullets)
- Key lessons learned
- Adjustments for next week
- Overall letter grade (A-F)

STEP 5 — If a rule needs to change (proven out for 2+ weeks, or failed
badly), also update memory/$BOT_ID/$STRATEGY/TRADING-STRATEGY.md and call out the change
in the review.

STEP 6 — Stash this bot's weekly digest block into the fleet
accumulator (the consolidated Discord post goes out once in STEP 7,
AFTER the per-bot loop). Preserve the body format exactly:

  { printf '\x1e%s\t%s\n' "$BOT_ID" "$BOT_NAME"
    printf '%s\n' "💰 Portfolio: \$X (±X.X% week, ±X.X% phase)
📊 vs SPY: ±X.X% week, ±X.X% phase

Trades: N (W:X / L:Y / open:Z)
Best: SYM +X.X%   Worst: SYM -X.X%
Win rate: X% | Profit factor: X.X

Sector ledger:
• Tech: 2W / 0L
• Healthcare: 0W / 1L

Takeaway: <one-liner>
Grade: <A-F>"; } >> "$FLEET_DIGEST"

Render the sector ledger as one bullet per sector that traded this week
(omit sectors with zero activity). If no trades closed this week, write
"No closed trades this week." in place of the sector ledger bullets.

STEP 7 — Send ONE consolidated weekly recap to the weekly channel (runs
ONCE, AFTER the per-bot fan-out loop completes). Read $FLEET_DIGEST —
each bot wrote one `\x1e`-prefixed `BOT_ID<TAB>BOT_NAME` header line
followed by its weekly body — and emit a single message:

  bash scripts/discord.sh --type=weekly "📋 Week ending $DATE

── [<bot-name-1>] ──
<bot 1 weekly body>

── [<bot-name-2>] ──
<bot 2 weekly body>"

Do NOT export BOT_ID/BOT_NAME for this call — it is a fleet post, so it
must not get a per-bot [bot-name] prefix. If $FLEET_DIGEST is missing or
empty (every bot skipped preflight), send the one-liner "📋 Week ending
$DATE: all bots skipped (see preflight errors)" instead. If the
assembled message approaches ~1800 chars (Discord limit), trim the
longest per-bot bodies first — the per-bot WEEKLY-REVIEW.md files hold
the full detail. Finally: `rm -f "$FLEET_DIGEST"`.
<!-- STEPS-END -->
