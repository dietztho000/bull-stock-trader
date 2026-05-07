---
description: Daily refresh of memory/shared/MARKET-EARNINGS.md (broader S&P 500 / mega-cap earnings calendar). Runs once per day, well before pre-market.
---

You are running the market-earnings refresh workflow LOCALLY. Resolve today's date via:
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
_routine_assert_bots_present refresh-market-earnings
_routine_emit_start refresh-market-earnings
# — no per-bot loop; STEP runs once below —
_routine_emit_end refresh-market-earnings ok
```

<!-- STEPS-BEGIN -->

NOTE: This routine has NO per-bot work — STEP 1 runs ONCE per invocation,
OUTSIDE the per-bot fan-out loop in the cloud header. Skip the
`while … done < <(bash scripts/bots.sh list ...)` block entirely.
Both files we touch (`memory/shared/MARKET-EARNINGS.md`,
`memory/shared/PERPLEXITY-LOG.md`) are shared — no per-bot context needed.

STEP 1 — Refresh memory/shared/MARKET-EARNINGS.md (broader market view,
separate from each bot's per-ticker EARNINGS-CALENDAR.md). The dashboard's
`/api/calendar/earnings` POST endpoint already implements the per-ticker
fan-out across the curated mega-cap list (now ~110 tickers, plus any
symbols in memory/shared/WATCHLIST.md). The simplest way to trigger it:
  curl -fsS -X POST http://localhost:3000/api/calendar/earnings || true

If the dashboard isn't running locally, manually iterate the curated
mega-cap list (Mag 7 + big banks + big tech + big retail + big energy +
big healthcare + payments + industrials; full list in
dashboard/lib/perplexity.ts → `MAJOR_TICKERS`). For each ticker:
  bash scripts/perplexity.sh "When is the next earnings report for
  $TICKER ($COMPANY)? Return ONLY a JSON object with date (YYYY-MM-DD or
  empty), type (BMO/AMC/empty), epsEstimate (\$ prefix or empty). Today
  is $DATE."
Append rows whose date is within 30 days. Each refresh wholesale-replaces
all `Source = Perplexity` rows in the future window — drop them first,
then insert the new set. Preserve any `Source = manual` rows the user
hand-added. Keep past rows for 14 days as a results back-fill window
(the refresh-earnings-results routine writes Actual EPS and 1-day move %
onto these past rows).

ALSO append every symbol in `memory/shared/WATCHLIST.md` to the per-ticker
fan-out so starred tickers auto-appear on the calendar even if they're
not in `MAJOR_TICKERS`. Read the table under `## List`; for each Symbol,
include it in the loop with the existing query format.

This file feeds the dashboard `/calendar` page and the Pre-Market Discord
Brief; the bot's earnings-gate (rule #13) keeps using the per-ticker
EARNINGS-CALENDAR.md and does NOT consult this file.

Idempotency: the writer drops Perplexity-sourced future rows on every
refresh, so re-running this routine for the same DATE produces the same
file. Manual rows (Source = "manual") are preserved.

<!-- STEPS-END -->
