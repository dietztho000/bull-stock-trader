---
description: Local Friday weekly review. Computes W/L stats, grades the week, updates strategy if a rule has proven out or failed.
---

You are running the Friday weekly review workflow LOCALLY. Resolve today's date via:
DATE=$(date +%Y-%m-%d).

Credentials come from the local .env. No env-var check block. No commit/push step.

<!-- STEPS-BEGIN -->
STEP 1 — Read memory for full week context:
- memory/WEEKLY-REVIEW.md (match existing template exactly)
- ALL this week's entries in memory/TRADE-LOG.md
- ALL this week's entries in memory/RESEARCH-LOG.md
- memory/BENCHMARK.md (last 7 daily rows for the alpha trend)
- memory/SECTOR-LEDGER.md (sector rotation health check)
- memory/TRADING-STRATEGY.md

STEP 2 — Pull week-end state:
  bash scripts/alpaca.sh account
  bash scripts/alpaca.sh positions

STEP 3 — Compute the week's metrics:
- Starting portfolio (Monday AM equity)
- Ending portfolio (today's equity)
- Week return ($ and %)
- S&P 500 week return: read from BENCHMARK.md (Monday→Friday SPY closes);
  fall back to perplexity.sh "S&P 500 weekly performance week ending $DATE"
  only if BENCHMARK.md is empty.
- Alpha for the week (portfolio_return - SPY_return)
- Trades taken (W/L/open)
- Win rate (closed trades only)
- Best trade, worst trade
- Profit factor (sum winners / |sum losers|)
- Render a 7-day ASCII sparkline of alpha_phase from BENCHMARK.md

STEP 4 — Append full review section to memory/WEEKLY-REVIEW.md.
**Idempotency guard:** grep for `## Week ending $DATE` first. If a section
for this week already exists (routine re-fired, or you ran it manually
earlier), REPLACE it in place. Never duplicate a weekly entry.

The review should include:
- Week stats table (include alpha + sparkline)
- Closed trades table
- Open positions at week end
- Sector ledger summary (any sector at 1-loss streak — close to being blocked)
- Entry-scorer audit: do trades with score 8-10 outperform trades with
  score 7? (drives weekly rubric tuning)
- What worked (3-5 bullets)
- What didn't work (3-5 bullets)
- Key lessons learned
- Adjustments for next week
- Overall letter grade (A-F)

STEP 5 — If a rule needs to change (proven out for 2+ weeks, or failed
badly), also update memory/TRADING-STRATEGY.md and call out the change
in the review.

STEP 6 — Send ONE Discord message. <= 15 lines:
  bash scripts/discord.sh --type=weekly "Week ending MMM DD
  Portfolio: \$X (±X% week, ±X% phase)
  vs S&P 500: ±X% week, ±X% phase
  Trades: N (W:X / L:Y / open:Z)
  Best: SYM +X%   Worst: SYM -X%
  One-line takeaway: <...>
  Grade: <letter>"
<!-- STEPS-END -->
