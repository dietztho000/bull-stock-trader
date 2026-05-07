---
description: Daily back-fill of Actual EPS and 1-day post-print move % onto past-dated rows in memory/shared/MARKET-EARNINGS.md. Lets the dashboard /calendar page show beat/miss inline alongside the estimate.
---

You are running the earnings-results back-fill workflow LOCALLY. Resolve today's date via:
DATE=$(date +%Y-%m-%d).

Credentials come from the local .env file (the wrapper scripts source it
automatically). No env-var check block. No commit/push step — the user
controls git locally.

This routine writes a SHARED file (`memory/shared/MARKET-EARNINGS.md`)
and does NOT need the per-bot fan-out loop. The cloud version skips the
fan-out wrapper and runs the STEP block once per execution.

```bash
DATE=$(date +%Y-%m-%d)
source scripts/_routine-header.sh
_routine_assert_bots_present refresh-earnings-results
_routine_emit_start refresh-earnings-results
# — no per-bot loop; STEP runs once below —
_routine_emit_end refresh-earnings-results ok
```

<!-- STEPS-BEGIN -->

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

<!-- STEPS-END -->
