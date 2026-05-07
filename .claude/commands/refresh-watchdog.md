---
description: Weekend-only watchdog that verifies the 3 daily refresh routines (market-earnings, economic-events, earnings-results) fired today. Daily-summary already covers weekdays via its STEP 6 watchdog; this fills the Sat/Sun gap.
---

You are running the refresh-watchdog workflow LOCALLY. Resolve today's date via:
DATE=$(date +%Y-%m-%d).

Credentials come from the local .env file. No env-var check block. No
commit/push step — the user controls git locally.

This routine writes per-bot RUN-LOG entries (the heartbeat) and reads any
single bot's RUN-LOG.jsonl to compute fired-vs-expected for the day. The
expected set is fleet-wide (the same routines fire for every bot), so
reading any single bot's log is sufficient.

```bash
DATE=$(date +%Y-%m-%d)
source scripts/_routine-header.sh
_routine_assert_bots_present refresh-watchdog
_routine_emit_start refresh-watchdog
# — no per-bot loop; STEP runs once below —
_routine_emit_end refresh-watchdog ok
```

<!-- STEPS-BEGIN -->

NOTE: This routine has NO per-bot work — STEP 1 runs ONCE per invocation,
OUTSIDE the per-bot fan-out loop in the cloud header. Skip the
`while … done < <(bash scripts/bots.sh list ...)` block entirely.

STEP 1 — Run-log watchdog (weekend variant).

Pick any one bot's `memory/$BOT_ID/$STRATEGY/RUN-LOG.jsonl` (use
`bash scripts/bots.sh list` and take the first row).

  EXPECTED = {refresh-market-earnings, refresh-economic-events,
              refresh-earnings-results}
  FIRED    = set of routines with at least one
             `{"action":"end","status":"ok"}` row whose timestamp starts
             with $DATE
  MISSING  = EXPECTED - FIRED

If MISSING is non-empty, fire (preserve format):

  bash scripts/discord.sh --type=auth-canary "⚠️ Refresh watchdog — $DATE (weekend)

Missing refresh routines: <comma-separated list>
Fired refresh routines: <comma-separated list>

Action: check the cloud Routines UI for the missing ones — Sat/Sun runs
have no daily-summary watchdog so this catches silent no-ops."

This goes to the auth-canary (bot-health) channel so it sits alongside
the morning auth checks instead of mixing with in-flight workflow errors.

If MISSING is empty, exit silently — no news is good news, but the
heartbeat in RUN-LOG.jsonl (emitted by the cloud-header SETUP block) is
the all-clear signal for any future "did refresh-watchdog itself run?"
checks.

<!-- STEPS-END -->
