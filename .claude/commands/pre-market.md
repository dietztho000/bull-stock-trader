---
description: Local pre-market research workflow. Reads memory, pulls state, runs Perplexity research, writes today's research log entry.
---

You are running the pre-market research workflow LOCALLY. Resolve today's date via:
DATE=$(date +%Y-%m-%d).

Credentials come from the local .env file (the wrapper scripts source it
automatically). No env-var check block. No commit/push step — the user
controls git locally.

**LOCAL fan-out** — when invoked via `/pre-market`, source the registry
helpers and run the per-bot loop yourself. Cloud routines get this same
logic from `routines/_cloud-header.md` (do not duplicate inside STEPS):

```bash
DATE=$(date +%Y-%m-%d)
source scripts/_routine-header.sh
_routine_assert_bots_present pre-market
_routine_emit_start pre-market
while IFS=$'\t' read -r BOT_ID ACCOUNT_ID STRATEGY BOT_ALLOCATION BOT_MODE; do
  export BOT_ID ACCOUNT_ID STRATEGY BOT_ALLOCATION BOT_MODE
  _routine_preflight_or_skip pre-market || continue
  # — STEPS 1..N below execute per bot —
done < <(bash scripts/bots.sh list --routine=pre-market)
_routine_emit_end pre-market ok
```

<!-- STEPS-BEGIN -->

STEP 1 — Read memory for context:
- memory/$BOT_ID/$STRATEGY/TRADING-STRATEGY.md
- tail of memory/$BOT_ID/$STRATEGY/TRADE-LOG.md
- tail of memory/$BOT_ID/$STRATEGY/RESEARCH-LOG.md
- memory/$BOT_ID/$STRATEGY/SECTOR-LEDGER.md (recent sector outcomes — relevant when picking ideas)

STEP 2 — Pull live account state:
  bash scripts/alpaca.sh --account-id="$ACCOUNT_ID" --bot-id="$BOT_ID" account
  bash scripts/alpaca.sh --account-id="$ACCOUNT_ID" --bot-id="$BOT_ID" positions
  bash scripts/alpaca.sh --account-id="$ACCOUNT_ID" --bot-id="$BOT_ID" orders

STEP 3 — Research market context via Perplexity. Run
bash scripts/perplexity.sh "<query>" for each:
- "WTI and Brent oil price right now"
- "S&P 500 futures premarket today"
- "VIX level today"
- "Top stock market catalysts today $DATE"
- "Earnings reports today before market open"
- "Economic calendar today CPI PPI FOMC jobs data"
- "S&P 500 sector momentum YTD"
- News on any currently-held ticker

If Perplexity exits 3, fall back to native WebSearch and note the
fallback in the log entry.

STEP 3b — Refresh memory/$BOT_ID/$STRATEGY/EARNINGS-CALENDAR.md. For every ticker that
appears in today's plan AND every currently-open position, check the row in
EARNINGS-CALENDAR.md. If the row is missing OR `Date refreshed` is more
than 7 days ago, query:
  bash scripts/perplexity.sh "When is the next earnings report for $TICKER? Return the date in YYYY-MM-DD format and whether it is BMO (before market open) or AMC (after market close)."
Append/replace the row using the grep-and-replace idempotency pattern (the
table key is the Symbol column). Set `Date refreshed = $DATE` and
`Source = Perplexity` (or `WebSearch` if the fallback fired).
Skip silently if a ticker has no upcoming earnings within 90 days; note
"none-90d" in the Date column so we don't re-query daily.

STEP 3c — Refresh memory/shared/ECONOMIC-CALENDAR.md.

**Skip guard (NEW 2026-05-06):** if
`grep -q "Date refreshed.*$DATE" memory/shared/ECONOMIC-CALENDAR.md`
matches, today's `refresh-economic-events` routine (04:45 CT) already
populated the file — SKIP the rest of this step. The body below remains
as a safety-net fallback for the day the dedicated routine fails to
fire.

Query Perplexity once per pre-market run for the next 14 days of US
economic events:
  bash scripts/perplexity.sh "List all scheduled US economic events for the
  next 14 calendar days starting $DATE. For each event return: date
  (YYYY-MM-DD), time (Eastern, HH:MM 24h), event name (e.g. CPI YoY, FOMC
  Minutes, Initial Jobless Claims, Nonfarm Payrolls), importance
  (high|medium|low), forecast value (string), previous value (string).
  Output ONLY a JSON array, no prose, no citations."
Parse the JSON. For each event, idempotency key = (Date + Event); grep for
`| $DATE | <time> | $EVENT |` in ECONOMIC-CALENDAR.md and replace in place
if present, else append a new row in the `## Calendar` table. Set
`Date refreshed = $DATE` and `Source = Perplexity` (or `WebSearch` if the
fallback fired). Skip silently if Perplexity returns no events. Drop rows
whose Date is before today (housekeeping — keeps the file from growing
unbounded). Like STEP 3b, this is idempotent on retry.

STEP 3d — Refresh memory/shared/MARKET-EARNINGS.md (broader market view, separate
from the per-ticker EARNINGS-CALENDAR.md).

**Skip guard (NEW 2026-05-06):** if
`grep -q "Date refreshed.*$DATE" memory/shared/MARKET-EARNINGS.md`
matches, today's `refresh-market-earnings` routine (04:30 CT) already
populated the file — SKIP the rest of this step. The body below remains
as a safety-net fallback for the day the dedicated routine fails to
fire.

Otherwise, this is **weekly cadence, not daily**: also skip this step
entirely if every row in the file's `## Calendar` table has
`Date refreshed` >= ($DATE - 6 days). Otherwise, the dashboard's
`/api/calendar/earnings` POST endpoint already implements this (per-ticker
fan-out across a curated mega-cap list — see
dashboard/lib/perplexity.ts → fetchMarketEarnings). The simplest way to
trigger it from the routine is:
  curl -fsS -X POST http://localhost:3000/api/calendar/earnings || \
    echo "Note: dashboard not running — skipped MARKET-EARNINGS refresh"
If the dashboard isn't running locally, manually iterate the curated
mega-cap list (Mag 7 + big banks + big tech + big retail + big energy +
big healthcare; full list in lib/perplexity.ts) and for each ticker:
  bash scripts/perplexity.sh "When is the next earnings report for
  $TICKER ($COMPANY)? Return ONLY a JSON object with date (YYYY-MM-DD or
  empty), type (BMO/AMC/empty), epsEstimate (\$ prefix or empty). Today
  is $DATE."
Append rows whose date is within 30 days. Each refresh wholesale-replaces
all `Source = Perplexity` rows in the future window — drop them first,
then insert the new set. Preserve any `Source = manual` rows the user
hand-added. This file feeds the dashboard `/calendar` page and the
Pre-Market Discord Brief; the bot's earnings-gate (rule #13) keeps using
the per-ticker EARNINGS-CALENDAR.md and does NOT consult this file.

STEP 4 — Write a dated entry to memory/$BOT_ID/$STRATEGY/RESEARCH-LOG.md.
**Idempotency guard:** before appending, grep for `## $DATE — Pre-market Research`
in memory/$BOT_ID/$STRATEGY/RESEARCH-LOG.md. If a section for today already exists, REPLACE it
in place rather than appending a duplicate. A "Run again" of this routine
must NEVER produce two entries for the same date.

The dated entry should include:
- Account snapshot (equity, cash, buying power, daytrade count)
- Market context (oil, indices, VIX, today's releases)
- 2-3 actionable trade ideas WITH catalyst + entry/stop/target
- Sector check: cross-reference each idea against memory/$BOT_ID/$STRATEGY/SECTOR-LEDGER.md;
  flag any idea in a sector with a 2-loss streak (rule #10 will block it
  at /trade time anyway, but call it out here)
- Risk factors for the day
- Decision: trade or HOLD (default HOLD — patience > activity)

STEP 5 — ALWAYS post a research summary to the research channel.
Use this exact format (preserve emojis, blank line, and bullets):

  bash scripts/discord.sh --type=research "🔬 Pre-market — $DATE

📊 Market context:
• WTI: \$X / Brent: \$Y
• S&P futures: ±X.X% | VIX: XX.X
• Catalysts: <one-liner of today's biggest>

💡 Trade ideas (N):
1. SYM — entry \$X, stop \$Y, target \$Z (catalyst: <one-liner>)
2. SYM — entry \$X, stop \$Y, target \$Z (catalyst: <one-liner>)

⚠️ Risk factors: <one-liner>

Decision: HOLD"

If the decision is TRADE, write "Decision: TRADE — see market-open at 8:30 CT".
If a Perplexity query exits 3 (key missing), append a final line "Note:
Perplexity unavailable — used WebSearch fallback." before the Decision line.
Truncate any section to keep the total under ~1800 chars (Discord limit).

STEP 6 — Fleet-wide held-position earnings ping (runs ONCE, AFTER the
per-bot fan-out completes). Single Discord post listing each ticker
with all bots holding it, instead of one ping per bot which duplicates
when multiple bots hold the same name.

For each enabled bot (re-iterate `bash scripts/bots.sh list`), run
  bash scripts/alpaca.sh --account-id="$ACCOUNT_ID" --bot-id="$BOT_ID" positions
and accumulate (ticker → list of bot_ids holding it). Then grep
memory/shared/MARKET-EARNINGS.md for rows whose `Earnings Date = $DATE`
to find which held tickers have earnings today. Build a map:

  $EARNINGS_TODAY = { ticker: [bot_ids], ... }
                    where ticker has earnings today AND is held by ≥1 bot

If empty, exit silently. Otherwise:

  bash scripts/discord.sh --type=research "📰 EARNINGS TODAY (fleet)

<for each (ticker, bots) in $EARNINGS_TODAY>:
• <ticker> — held by: <comma-separated bot_ids>

Earnings gate (rule #13): market-open will force-exit each at the close
BEFORE the print."

**Idempotency:** before sending, grep memory/shared/DAILY-SUMMARY.md for
`<!-- earnings-ping $DATE -->` (a hidden HTML comment used as the anchor;
DAILY-SUMMARY.md is the natural shared home since this is a fleet-wide
post). If the anchor exists, SKIP this step. Otherwise, after the Discord
post succeeds, append the comment as the first line of today's section
once daily-summary writes it (or write a one-liner section now and let
daily-summary's grep-for-date logic merge with it). The simplest
idempotent shape: append to a NEW shared file
`memory/shared/EARNINGS-PINGS.md` keyed by date; grep that file for
`## $DATE` first.

If `memory/shared/EARNINGS-PINGS.md` doesn't exist, create it with header
`# Earnings ping log — fleet-wide held-position earnings reminders` then
the dated section. The dashboard ignores this file (informational only).
<!-- STEPS-END -->
