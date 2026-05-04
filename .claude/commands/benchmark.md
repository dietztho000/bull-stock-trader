---
description: Read-only YTD-vs-SPY benchmark snapshot. Renders 30-day alpha sparkline. No state changes.
---

Print a clean ad-hoc benchmark snapshot. No state changes, no orders, no file writes.

The bot's mission is to BEAT THE S&P 500. This is the dashboard for that mission.

1. Read memory/${BOT_MODE:-live}/${STRATEGY:-default}/BENCHMARK.md (last 30 daily rows + first row for phase start).
2. Pull a fresh equity number:
     bash scripts/alpaca.sh account
3. Pull SPY's latest close:
     bash scripts/alpaca.sh quote SPY
4. Compute and print:

Benchmark — <today's date>
Phase start: <YYYY-MM-DD> | Days: N
Portfolio: $X (±X.X% phase) | SPY: $X (±X.X% phase) | Alpha: ±X.X%
Last 7 days alpha (sparkline): ▁▂▃▅▇█▇   day-by-day pct: +0.4 +0.1 -0.2 +0.3 +0.5 +0.6 +0.5
Best alpha day: YYYY-MM-DD (+X.X%)
Worst alpha day: YYYY-MM-DD (-X.X%)
Verdict: [BEATING / TRACKING / TRAILING] the index by ±X.X% over N days.

5. Render the sparkline using these blocks:
   ▁ ▂ ▃ ▄ ▅ ▆ ▇ █  (8 levels). Map min(alpha) → ▁, max(alpha) → █.

6. Backfill check: if memory/${BOT_MODE:-live}/${STRATEGY:-default}/BENCHMARK.md has fewer than 5 rows (first
   run), print "Backfilling from Alpaca portfolio history..." and run:
     bash scripts/alpaca.sh portfolio-history 1A 1D
   Combined with daily SPY closes (perplexity.sh fallback if needed),
   write a backfilled table to memory/${BOT_MODE:-live}/${STRATEGY:-default}/BENCHMARK.md and warn the user
   that this routine is read-only — they need to commit the backfill
   manually.

No commentary unless something is broken (alpha < -10%, or no rows).
