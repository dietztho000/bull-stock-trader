<!-- AUTO-GENERATED from .claude/commands/auth-canary.md by scripts/build-routines.sh — do not edit directly. -->

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
_routine_assert_bots_present auth-canary
_routine_emit_start auth-canary
```

## MANDATORY — WRAP STEPS 1..N IN THIS PER-BOT FAN-OUT LOOP

The numbered STEP blocks below execute **once per enabled bot**. Source
the bot list from `bash scripts/bots.sh list --routine=auth-canary`
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
  _routine_preflight_or_skip auth-canary || continue
  # ── STEPS 1..N from below run here for this bot ──
  # All memory paths use $BOT_ID/$STRATEGY.
  # All alpaca.sh calls include --account-id="$ACCOUNT_ID" --bot-id="$BOT_ID".
done < <(bash scripts/bots.sh list --routine=auth-canary)
```

After the loop completes, run the FINAL STEP from the footer (also
mandatory — it emits the routine-completed heartbeat and commits + pushes
all per-bot writes in a single batch).


STEP 1 — Alpaca account check (broker auth — most critical). Capture
result for STEP 5:
  bash scripts/alpaca.sh --account-id="$ACCOUNT_ID" --bot-id="$BOT_ID" account
Stash: ALPACA_ACCOUNT_OK = (true|false), ACCOUNT_NUMBER = "PA…" or empty,
ALPACA_ACCOUNT_ERR = "<HTTP code or message>" if false.

STEP 2 — Alpaca data feed check. Capture result:
  bash scripts/alpaca.sh --account-id="$ACCOUNT_ID" --bot-id="$BOT_ID" quote SPY
Stash: ALPACA_DATA_OK, SPY_PRICE = "$X.XX" (the .quote.ap value), DATA_ERR.

STEP 3 — Perplexity check. Capture result:
  bash scripts/perplexity.sh "current S&P 500 level (one number)"
Stash: PERPLEXITY_OK (treat exit-3 fallback as PERPLEXITY_OK=false), PPLX_ERR.

STEP 4 — Discord webhook check (proves the auth-canary webhook works):
  bash scripts/discord.sh --type=auth-canary "📡 Auth canary $DATE: webhook self-test"
If this exits non-zero, Discord webhook is broken — STEP 5's main post
also won't land, so log to TRADE-LOG (STEP 6) and exit with that error
in the routine's run log.

STEP 5 — ALWAYS post the structured summary to the auth-canary channel.
Build it from the stashed STEP 1-3 results. Format EXACTLY (preserve the
emojis, blank line, and bullets):

If all four checks passed:
  bash scripts/discord.sh --type=auth-canary "📡 Auth canary — $DATE

✓ Alpaca account: ok (acct $ACCOUNT_NUMBER)
✓ Alpaca data feed: ok (SPY $SPY_PRICE)
✓ Perplexity: ok
✓ Discord webhook: ok (this message)

All systems healthy."

If any check failed, replace its ✓ line with ✗ and a brief reason; change
the trailing line to "Action: rotate keys / check provider status." and
prefix the title with ⚠️ instead of 📡. Example failed Perplexity:

  bash scripts/discord.sh --type=auth-canary "⚠️ Auth canary — $DATE

✓ Alpaca account: ok (acct PA328…)
✓ Alpaca data feed: ok (SPY \$689.60)
✗ Perplexity: FAIL (401 unauthorized)
✓ Discord webhook: ok (this message)

Action: rotate PERPLEXITY_API_KEY."

STEP 6 — On any failure in STEP 1-3, ALSO write a one-line audit entry to
memory/$BOT_ID/$STRATEGY/TRADE-LOG.md so the audit trail captures the outage. Idempotency
guard per CLAUDE.md: grep for `### $DATE HH:MM — Auth canary` first; if a
section for this minute already exists, skip the append.

  ### YYYY-MM-DD HH:MM — Auth canary FAILED
  - Alpaca account: <ok|FAIL: 401>
  - Alpaca data:    <ok|FAIL: 5xx>
  - Perplexity:     <ok|FAIL: 401>

## MANDATORY — FINAL STEP (run after the per-bot fan-out loop completes)

Emits the routine-completed heartbeat to every enabled bot's
RUN-LOG.jsonl, then commits + pushes every per-bot and shared write
captured during the loop in a single batch.

```bash
_routine_emit_end auth-canary ok
git add memory/
if git diff --cached --quiet; then
  echo "no memory changes to commit"
else
  git commit -m "auth-canary $DATE ($(bash scripts/bots.sh count) bots)"
  git push origin main
fi
```

**On push failure** (rule #21): retry up to 3 times —
`git pull --rebase origin main && git push origin main`, sleeping ~3s
between attempts. If still failing after 3 tries, send one Discord
--type=error post and exit non-zero. Never force-push.
