---
description: Pre-dawn auth health check. Pings every external API the bot depends on and screams loudly if any are broken.
---

You are running the auth-canary workflow. Resolve today's date via:
DATE=$(date +%Y-%m-%d).

This routine fires at 03:30 CT (04:30 ET) every weekday — about 5 hours
before market-open. Its only job is to surface broken credentials early
enough that the user has time to rotate keys before pre-market fires.

Be terse internally; the Discord post is the user-facing surface and follows
a strict format (see STEP 5).

<!-- STEPS-BEGIN -->

PER-BOT FAN-OUT — every numbered STEP below runs ONCE PER ENABLED BOT.
Read the registry first:

  if [[ "$(bash scripts/bots.sh count)" == "0" ]]; then
    bash scripts/discord.sh --type=error "No enabled bots in registry — aborting auth-canary"
    exit 0
  fi

  while IFS=$'	' read -r BOT_ID ACCOUNT_ID STRATEGY BOT_ALLOCATION BOT_MODE; do
    export BOT_ID ACCOUNT_ID STRATEGY BOT_ALLOCATION BOT_MODE
    bash scripts/auth-preflight.sh auth-canary --account-id="$ACCOUNT_ID" || continue
    # ─── run STEPS 1..N below for this bot ────────────────────────────
  done < <(bash scripts/bots.sh list)

Everything beneath this preamble runs inside that loop. $BOT_ID,
$ACCOUNT_ID, $STRATEGY, $BOT_ALLOCATION, $BOT_MODE are guaranteed set.
Memory paths use $BOT_ID/$STRATEGY. Every alpaca.sh call already
includes --account-id="$ACCOUNT_ID" --bot-id="$BOT_ID".

NOTE: pre-market does Perplexity research that is conceptually shared
across bots. The grep-first idempotency rule on PERPLEXITY-LOG.md means
the 2nd, 3rd, … bot iterations will skip the duplicate Perplexity call
when today's answer is already cached. daily-summary and weekly-review
post one Discord summary per bot in this Phase 1 implementation; a Phase
2 refactor aggregates them into a single multi-bot summary.

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
<!-- STEPS-END -->
