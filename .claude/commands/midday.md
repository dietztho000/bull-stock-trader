---
description: Local midday scan. Cuts losers at -7%, tightens trailing stops on winners, thesis-checks open positions.
---

You are running the midday scan workflow LOCALLY. Resolve today's date via:
DATE=$(date +%Y-%m-%d).

Credentials come from the local .env. No env-var check block. No commit/push step.

<!-- STEPS-BEGIN -->
STEP 1 — Read memory so you know what's open and why:
- memory/TRADING-STRATEGY.md (exit rules)
- tail of memory/TRADE-LOG.md (entries, original thesis per position, stops)
- today's memory/RESEARCH-LOG.md entry

STEP 2 — Pull current state:
  bash scripts/alpaca.sh positions
  bash scripts/alpaca.sh orders

STEP 3 — Cut losers immediately. For every position where
unrealized_plpc <= -0.07:
  bash scripts/alpaca.sh close SYM
  bash scripts/alpaca.sh cancel ORDER_ID   # cancel its trailing stop
Log the exit to TRADE-LOG: exit price, realized P&L, "cut at -7% per rule".
Append a closed-trade row to memory/SECTOR-LEDGER.md with sector + outcome
(L) so rule #10's 2-loss streak counter stays accurate.

STEP 4 — Tighten trailing stops on winners. Use replace-order in place
(never cancel-then-create — that briefly leaves the position un-stopped):
- Up >= +20% -> trail_percent: "5"
- Up >= +15% -> trail_percent: "7"
  bash scripts/alpaca.sh replace-order ORDER_ID --trail-percent 5
Never tighten within 3% of current price. Never move a stop down (Alpaca
will reject; the replace will return 4xx and you log it as "skipped:
would-move-down").

STEP 5 — Escalate any unfilled limit buys from market-open to MARKET if
the catalyst still holds. Cancel the limit, place a fresh market order,
re-place the trailing stop on fill.

STEP 6 — Thesis check. If a thesis broke intraday, cut the position even
if not at -7% yet. Document reasoning in TRADE-LOG and update SECTOR-LEDGER.

STEP 7 — Optional intraday research via Perplexity if something is moving
sharply with no obvious cause. Append afternoon addendum to RESEARCH-LOG.

STEP 8 — Notification: only if action was taken.
  bash scripts/discord.sh --type=midday "<action summary>"
<!-- STEPS-END -->
