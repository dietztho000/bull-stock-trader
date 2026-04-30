---
description: Pre-dawn auth health check. Pings every external API the bot depends on and screams loudly if any are broken.
---

You are running the auth-canary workflow. Resolve today's date via:
DATE=$(date +%Y-%m-%d).

This routine fires at 03:30 CT (04:30 ET) every weekday — about 5 hours
before market-open. Its only job is to surface broken credentials early
enough that the user has time to rotate keys before pre-market fires.

Be terse. Print one line per dependency. Exit non-zero if any check failed.

<!-- STEPS-BEGIN -->
STEP 1 — Alpaca account check (broker auth — most critical):
  bash scripts/alpaca.sh account
Capture exit status. Non-zero = STOP everything else, fire Discord error
naming the failure (401, 403, network, etc.), exit 1.

STEP 2 — Alpaca data feed check:
  bash scripts/alpaca.sh quote SPY
Non-zero = same handling. Data API can fail independently of trading API.

STEP 3 — Perplexity check (research dependency):
  bash scripts/perplexity.sh "current S&P 500 level (one number)"
Non-zero = note in summary; do NOT abort (Perplexity has a documented
exit-3 fallback to WebSearch, and other routines tolerate research being
soft-down).

STEP 4 — Discord webhook check:
  bash scripts/discord.sh --type=auth-canary "auth-canary $DATE: testing webhook"
The fact that this Discord post landed at all is the test — if the
auth-canary webhook is dead, you won't see the message at all (silent
fail). Mention this limitation in the summary line.

STEP 5 — Summary post (only if anything degraded):
  bash scripts/discord.sh --type=auth-canary "auth-canary $DATE FAIL: <which checks failed, in plain words>"
If everything passed, EXIT SILENTLY — the test post in STEP 4 already
proved Discord works. No "all good" spam.

STEP 6 — On any failure in STEP 1-3, also write a one-line entry to
memory/TRADE-LOG.md so the audit trail captures the outage:
  ### YYYY-MM-DD HH:MM — Auth canary FAILED
  - Alpaca account: <ok|FAIL: 401>
  - Alpaca data:    <ok|FAIL: 5xx>
  - Perplexity:     <ok|FAIL: 401>
<!-- STEPS-END -->
