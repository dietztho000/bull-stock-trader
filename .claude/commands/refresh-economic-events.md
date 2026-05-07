---
description: Daily refresh of memory/shared/ECONOMIC-CALENDAR.md (US macro events for next 14 days). Runs every day, weekends included — macro releases happen on weekends too (US Treasury reports, Fed speeches, surprise rate decisions).
---

You are running the economic-events refresh workflow LOCALLY. Resolve today's date via:
DATE=$(date +%Y-%m-%d).

Credentials come from the local .env file (the wrapper scripts source it
automatically). No env-var check block. No commit/push step — the user
controls git locally.

This routine writes a SHARED file (`memory/shared/ECONOMIC-CALENDAR.md`)
and does NOT need the per-bot fan-out loop. The cloud version skips the
fan-out wrapper and runs the STEP block once per execution.

```bash
DATE=$(date +%Y-%m-%d)
source scripts/_routine-header.sh
_routine_assert_bots_present refresh-economic-events
_routine_emit_start refresh-economic-events
# — no per-bot loop; STEP runs once below —
_routine_emit_end refresh-economic-events ok
```

<!-- STEPS-BEGIN -->

NOTE: This routine has NO per-bot work — STEP 1 runs ONCE per invocation,
OUTSIDE the per-bot fan-out loop in the cloud header. Skip the
`while … done < <(bash scripts/bots.sh list ...)` block entirely.
The file we touch (`memory/shared/ECONOMIC-CALENDAR.md`) is shared — no
per-bot context needed.

STEP 1 — Refresh memory/shared/ECONOMIC-CALENDAR.md. Query Perplexity once
for the next 14 days of US economic events:
  bash scripts/perplexity.sh "List all scheduled US economic events for the
  next 14 calendar days starting $DATE. For each event return: date
  (YYYY-MM-DD), time (Eastern, HH:MM 24h), event name (e.g. CPI YoY, FOMC
  Minutes, Initial Jobless Claims, Nonfarm Payrolls), importance
  (high|medium|low), forecast value (string), previous value (string).
  Output ONLY a JSON array, no prose, no citations."

The dashboard's `/api/calendar/economic` POST endpoint already implements
this; the simplest way to trigger it from the routine is:
  curl -fsS -X POST http://localhost:3000/api/calendar/economic || true

If the dashboard isn't running locally, fall back to the bash-only path
above and write rows manually:
- Parse the JSON. For each event, idempotency key = (Date + Event); grep
  for `| $DATE | <time> | $EVENT |` in ECONOMIC-CALENDAR.md and replace
  in place if present, else append a new row in the `## Calendar` table.
- Set `Date refreshed = $DATE` and `Source = Perplexity` (or `WebSearch`
  if the fallback fired).
- Skip silently if Perplexity returns no events.
- Drop rows whose Date is before today (housekeeping — keeps the file
  from growing unbounded).

Idempotency: the writer is keyed on (Date + Event), so re-running this
routine for the same DATE produces the same file.

<!-- STEPS-END -->
