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

STEP 1 — Run-log watchdog (weekend variant). Run this VERBATIM — do not
paraphrase, do not re-grep the logs by hand:

```bash
eval "$(bash scripts/eod-health.sh --mode=refresh --post)"
```

`scripts/eod-health.sh --mode=refresh` deterministically checks that the
3 daily refresh routines (refresh-market-earnings, refresh-economic-events,
refresh-earnings-results) all have at least one `{"action":"end","status":"ok"}`
row in any one bot's RUN-LOG.jsonl whose timestamp starts with today's
UTC date. The expected set is hard-coded; the date frame is UTC to match
how scripts/run-log.sh stamps timestamps. With `--post` and a non-empty
MISSING set, it fires the `⚠️ Refresh watchdog — $DATE (weekend)`
Discord post (--type=auth-canary, the bot-health channel) itself; with
an empty MISSING set it exits silently — no news is good news, and the
heartbeat in RUN-LOG.jsonl (emitted by the cloud-header SETUP block) is
the all-clear signal for any future "did refresh-watchdog itself run?"
checks. The `eval` exports `ROUTINES_FIRED`, `ROUTINES_EXPECTED`, and
`ROUTINES_MISSING` for any downstream STEP that wants to inspect them.

This replaces the old hand-grepped watchdog — same prose-bug class that
caused daily-summary to silently miscount on 2026-05-14 ("0/12 fired")
and refresh-watchdog to claim "Fired refresh routines: (none)" on
2026-05-17 despite the source data being correct.

<!-- STEPS-END -->
