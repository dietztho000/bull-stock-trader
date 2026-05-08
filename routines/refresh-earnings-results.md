<!-- AUTO-GENERATED from .claude/commands/refresh-earnings-results.md by scripts/build-routines.sh — do not edit directly. -->

You are an autonomous trading bot. Stocks only — NEVER touch options. Ultra-concise: short bullets, no fluff.

You are running this workflow as a CLOUD ROUTINE. Resolve today's date via:
DATE=$(date +%Y-%m-%d).

IMPORTANT — ENVIRONMENT VARIABLES:
- One credential set per Alpaca account is exported as namespaced env vars:
  ALPACA_<NS>_API_KEY, ALPACA_<NS>_SECRET_KEY, optional ALPACA_<NS>_ENDPOINT.
  <NS> is the account id uppercased with hyphens replaced by underscores
  (account `paper-100k` → ALPACA_PAPER_100K_API_KEY etc).
- Shared external creds: PERPLEXITY_API_KEY, PERPLEXITY_MODEL,
  DISCORD_WEBHOOK_URL.
- There is NO .env file in the cloud and you MUST NOT create, write, or
  source one. The wrapper scripts read directly from process env.
- If a wrapper prints "required env var(s) not set" or
  "--account-id=… requires …", STOP that bot's iteration, send one Discord
  --type=error post naming the missing var, and continue to the next bot.

IMPORTANT — PERSISTENCE:
- Fresh clone. File changes VANISH unless committed and pushed.
  The COMMIT AND PUSH step at the end is mandatory.

IMPORTANT — PER-BOT MEMORY LAYOUT:
- Per-bot files live at memory/$BOT_ID/$STRATEGY/<FILE>. The per-bot
  fan-out below sets BOT_ID and STRATEGY for each iteration.
- Cross-bot files (calendars, sector cache, perplexity log, dashboard
  prefs) live at memory/shared/<FILE>.
- Per-bot files: TRADING-STRATEGY.md, TRADE-LOG.md, RUN-LOG.jsonl,
  BENCHMARK.md, RESEARCH-LOG.md, SECTOR-LEDGER.md, WEEKLY-REVIEW.md,
  EARNINGS-CALENDAR.md, BACKTEST-RESULTS.{md,json}.
- Shared files: SECTOR-MAP.md, ECONOMIC-CALENDAR.md, MARKET-EARNINGS.md,
  PERPLEXITY-LOG.md, DAILY-SUMMARY.md, DASHBOARD-AUDIT.jsonl,
  dashboard-settings.json.

## MANDATORY — RUN THIS SETUP BLOCK BEFORE ANY STEP

This sources the registry helpers, aborts cleanly if the registry has no
enabled bots, and emits the routine-fired heartbeat to every enabled
bot's RUN-LOG.jsonl. **Skipping it makes the daily-summary watchdog
report this routine as "missing" even when it ran.**

```bash
DATE=$(date +%Y-%m-%d)
source scripts/_routine-header.sh
_routine_assert_bots_present refresh-earnings-results
_routine_emit_start refresh-earnings-results
```

## MANDATORY — WRAP STEPS 1..N IN THIS PER-BOT FAN-OUT LOOP

The numbered STEP blocks below execute **once per enabled bot**. Source
the bot list from `bash scripts/bots.sh list --routine=refresh-earnings-results`
(TAB-separated rows: `bot_id  account_id  strategy  allocation  mode  strategy_params_json`)
and iterate. The auth preflight inside the loop posts Discord + emits a
discriminated RUN-LOG entry on failure, so a bad-creds bot is logged
loudly and skipped without aborting the others.

The 6th column is a compact JSON array of typed param objects from the
strategies registry — `_routine_export_strategy_params` unpacks it into
per-key `STRATEGY_<KEY>` env vars (scalars: number/percent/enum) plus
`STRATEGY_<KEY>_JSON` for table params. Routines reference the resolved
values with `${STRATEGY_<KEY>:-<safe-default>}` so default-strategy bots
stay byte-identical to the pre-Phase-4 behavior.

```bash
while IFS=$'\t' read -r BOT_ID ACCOUNT_ID STRATEGY BOT_ALLOCATION BOT_MODE STRATEGY_PARAMS_JSON; do
  # bots.sh emits the literal string "null" for empty allocation so
  # consecutive tabs never appear (bash IFS-tab collapses them otherwise
  # and shifts later fields left). Translate back to empty for the
  # downstream "[[ -z "$BOT_ALLOCATION" ]]" tests in STEPS.
  [[ "$BOT_ALLOCATION" == "null" ]] && BOT_ALLOCATION=""
  export BOT_ID ACCOUNT_ID STRATEGY BOT_ALLOCATION BOT_MODE STRATEGY_PARAMS_JSON
  _routine_export_strategy_params
  _routine_preflight_or_skip refresh-earnings-results || continue
  # ── STEPS 1..N from below run here for this bot ──
  # All memory paths use $BOT_ID/$STRATEGY.
  # All alpaca.sh calls include --account-id="$ACCOUNT_ID" --bot-id="$BOT_ID".
done < <(bash scripts/bots.sh list --routine=refresh-earnings-results)
```

After the loop completes, run the FINAL STEP from the footer (also
mandatory — it emits the routine-completed heartbeat and commits + pushes
all per-bot writes in a single batch).


NOTE: This routine has NO per-bot work — STEP 1 runs ONCE per invocation,
OUTSIDE the per-bot fan-out loop in the cloud header. Skip the
`while … done < <(bash scripts/bots.sh list ...)` block entirely.
The file we touch (`memory/shared/MARKET-EARNINGS.md`) is shared — no
per-bot context needed.

STEP 1 — Back-fill earnings results onto past-dated rows in
memory/shared/MARKET-EARNINGS.md. The dashboard's
`/api/calendar/earnings-results` POST endpoint already implements this:

  curl -fsS -X POST http://localhost:3000/api/calendar/earnings-results || true

The endpoint:
1. Loads MARKET-EARNINGS.md.
2. Filters to rows whose `Earnings Date < $DATE` AND that don't already
   have `Actual EPS` + `1-day move %` populated.
3. Queries Perplexity for each candidate: actual EPS + percentage change
   on the next trading session after the print.
4. Writes the two trailing cells back via `writeEarningsResults()` —
   touch only those two cells; never modify other columns.

Past rows are kept for 14 days by the writer's housekeeping rule, so this
routine has a 14-day window to back-fill. If the dashboard isn't running
locally, fall back to bash:
- For each past-dated row in MARKET-EARNINGS.md (within 14 days, missing
  results), query:
  bash scripts/perplexity.sh "For $TICKER's earnings reported on $DATE,
  return ONLY a JSON object: {\"actualEps\":\"\$X.XX\" or empty,
  \"postPrintMovePct\":\"+X.X%\" with sign or empty}."
- Patch the row's trailing cells (positions 8 and 9 — `Actual EPS` and
  `1-day move %`) using awk or sed; never touch the leading cells.

Idempotency: the writer skips rows whose target cells are already
populated, so re-running this routine for the same DATE is a no-op once
all past rows in the retention window are filled. Symbols not in the
table are silently skipped.

## MANDATORY — FINAL STEP

Emits the routine-completed heartbeat (the daily-summary watchdog reads
RUN-LOG.jsonl to verify all expected routines fired), then commits +
pushes the shared write.

```bash
_routine_emit_end refresh-earnings-results ok
git add memory/
if git diff --cached --quiet; then
  echo "no memory changes to commit"
else
  git commit -m "refresh-earnings-results $DATE"
  git push origin main
fi
```

**On push failure** (rule #21): retry up to 3 times —
`git pull --rebase origin main && git push origin main`, sleeping ~3s
between attempts. If still failing after 3 tries, send one Discord
--type=error post and exit non-zero. Never force-push.
