# Bull Stock Trader — Quick Summary

An autonomous AI swing trading bot.

The twist: Claude (the AI) **is** the trader. There's no separate trading
program. Every weekday a fresh AI container clones a Git repo, reads its own
notes, calls the brokerage API, makes a decision, writes new notes, and
commits — every trade, every reason, every loss is permanent in the repo's
history.

## Strategy

Strict stocks-only:

- Max 6 open positions, max 20% per position, max 3 new trades per week.
- Every position gets a real 10% trailing stop placed at the broker — no
  "I'll watch it" softness.
- Cuts losers at -7%; tightens stops as winners run (7% at +15% gain,
  5% at +20%).
- Stops trading a sector entirely after 2 consecutive losing trades there.

## Daily rhythm

Seven cron checks per weekday:

| Time (CT) | Routine | What it does |
|---|---|---|
| 3:30 AM | auth-canary | Pre-flight health check on every API |
| 6:00 AM | pre-market | Research catalysts, futures, VIX, earnings |
| 8:30 AM | market-open | Validate rules, execute trades, place stops |
| 12:00 PM | midday | Cut -7% losers, tighten winners, thesis check |
| 1:30 PM | stops | Reconcile every position has the right stop |
| 3:00 PM | daily-summary | EOD recap vs S&P 500, run-log watchdog |
| Fri 4:00 PM | weekly-review | Grade the week, calibrate rules |

Notifications fan out to category-specific Discord channels (fills, midday,
EOD, weekly, errors, health, etc.).

## Mission

Beat the S&P 500 over a fixed challenge window.

Currently in **paper mode** (~$10K simulated) for ~30 days to validate the
rules before going live with real money.
