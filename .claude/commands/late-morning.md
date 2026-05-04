---
description: 11:00 CT intraday scan. Promotes fixed stops to trailing once green, tightens winners, thesis-checks open positions.
---

You are running the late-morning scan workflow LOCALLY. Resolve today's date via:
DATE=$(date +%Y-%m-%d).

Credentials come from the local .env. No env-var check block. No commit/push step.

This routine fires 60 minutes before midday. It does NOT escalate unfilled
limit buys (mid-morning at 10:00 already handled that; by 11:00 a still-
unfilled limit is either irrelevant or midday will absorb it). Its jobs:
1. Promote fixed -7% entry stops to 10% trailing on any position now green.
2. Tighten trailing stops on winners per the ratchet table.
3. Thesis check on positions moving sharply.
4. Safety-net loser cut.

NO Perplexity calls.

<!-- STEPS-BEGIN -->

PER-BOT FAN-OUT — every numbered STEP below runs ONCE PER ENABLED BOT.
Read the registry first:

  if [[ "$(bash scripts/bots.sh count)" == "0" ]]; then
    bash scripts/discord.sh --type=error "No enabled bots in registry — aborting late-morning"
    exit 0
  fi

  while IFS=$'	' read -r BOT_ID ACCOUNT_ID STRATEGY BOT_ALLOCATION BOT_MODE; do
    export BOT_ID ACCOUNT_ID STRATEGY BOT_ALLOCATION BOT_MODE
    # Per-account preflight: skip this bot if its account creds are bad.
    bash scripts/auth-preflight.sh late-morning --account-id="$ACCOUNT_ID" || continue
    # ─── run STEPS 1..N below for this bot ────────────────────────────
  done < <(bash scripts/bots.sh list)

Everything beneath this preamble runs inside that loop. $BOT_ID,
$ACCOUNT_ID, $STRATEGY, $BOT_ALLOCATION, and $BOT_MODE are guaranteed set.
Memory paths use $BOT_ID/$STRATEGY. Every alpaca.sh call already
includes --account-id="$ACCOUNT_ID" --bot-id="$BOT_ID".

STEP 1 — Read memory so you know what's open and why:
- memory/$BOT_ID/$STRATEGY/TRADING-STRATEGY.md (exit rules)
- tail of memory/$BOT_ID/$STRATEGY/TRADE-LOG.md (entries, original thesis per position, stops)
- today's memory/$BOT_ID/$STRATEGY/RESEARCH-LOG.md entry
- memory/$BOT_ID/$STRATEGY/EARNINGS-CALENDAR.md (rule #13 — earnings exit)

STEP 2 — Pull current state:
  bash scripts/alpaca.sh --account-id="$ACCOUNT_ID" --bot-id="$BOT_ID" positions
  bash scripts/alpaca.sh --account-id="$ACCOUNT_ID" --bot-id="$BOT_ID" orders

STEP 3a — Earnings exit (rule #13). For each open position whose
EARNINGS-CALENDAR.md row has `Next Earnings Date == today`, force-exit
at market. Re-fetch positions first to avoid double-cuts:
  bash scripts/alpaca.sh --account-id="$ACCOUNT_ID" --bot-id="$BOT_ID" positions   # confirm still open
  bash scripts/alpaca.sh --account-id="$ACCOUNT_ID" --bot-id="$BOT_ID" close SYM
  bash scripts/alpaca.sh --account-id="$ACCOUNT_ID" --bot-id="$BOT_ID" cancel ORDER_ID
Log to TRADE-LOG: "exit: pre-earnings forced-close". Append a closed-trade
row to memory/$BOT_ID/$STRATEGY/SECTOR-LEDGER.md.

STEP 3 — Cut losers as a safety-net only. The fixed -7% stop GTC placed
at entry should have already fired on Alpaca's exchange. Before any close,
re-fetch positions to avoid double-cuts. For every position still open
with unrealized_plpc <= -0.07:
  bash scripts/alpaca.sh --account-id="$ACCOUNT_ID" --bot-id="$BOT_ID" positions   # confirm still open
  bash scripts/alpaca.sh --account-id="$ACCOUNT_ID" --bot-id="$BOT_ID" close SYM
  bash scripts/alpaca.sh --account-id="$ACCOUNT_ID" --bot-id="$BOT_ID" cancel ORDER_ID   # cancel its stop
Log the exit to TRADE-LOG: exit price, realized P&L, "cut at -7% (exchange
stop missed — illiquid/race)". Append a closed-trade row to
memory/$BOT_ID/$STRATEGY/SECTOR-LEDGER.md with sector + outcome (L).

STEP 4a — Promote fixed entry stops to a 10% trailing stop once green.
For every position with unrealized_plpc >= +0.01 whose lone open stop
order has type IN {"stop", "stop_limit"}, PATCH it in place:
  bash scripts/alpaca.sh --account-id="$ACCOUNT_ID" --bot-id="$BOT_ID" replace-order ORDER_ID --trail-percent 10
Idempotent: skip if type is already "trailing_stop".

STEP 4b — Tighten trailing stops on winners. Only operates on stops with
type == "trailing_stop". Use replace-order in place:
- Up >= +20% -> trail_percent: "5"
- Up >= +15% -> trail_percent: "7"
  bash scripts/alpaca.sh --account-id="$ACCOUNT_ID" --bot-id="$BOT_ID" replace-order ORDER_ID --trail-percent 5
Never tighten within 3% of current price. Never move a stop down (log
"skipped: would-move-down").

STEP 4c — Take-profit ladder rung 1 (rule #16). For every position with
unrealized_plpc >= +0.20 AND no `take-profit-50` annotation in TRADE-LOG
for this position's entry, sell half at market. Round qty/2 down to int;
skip if half_qty < 1.
  bash scripts/alpaca.sh --account-id="$ACCOUNT_ID" --bot-id="$BOT_ID" submit-order --symbol SYM --qty $half_qty --side sell --type market --tif day
Append to TRADE-LOG so this rung never fires twice:
  ### MMM DD HH:MM — Take-profit ladder
  - SYM: rung-1 fired @+X.X% — sold $half_qty/$total_qty (proceeds \$X.XX)
    take-profit-50: fired YYYY-MM-DD HH:MM at +X.X%
**Idempotency:** grep TRADE-LOG for `take-profit-50: fired` on this entry
first; if found, skip.

STEP 5 — Thesis check. If a thesis broke intraday (catalyst reversed,
sector rotation flipped), cut the position even if not at -7% yet.
Document reasoning in TRADE-LOG and update SECTOR-LEDGER.

STEP 6 — ALWAYS post a late-morning summary to the midday channel.

If actions fired (earnings exits, cuts, promotions, tightens, thesis breaks):
  bash scripts/discord.sh --type=midday "🎯 Late-morning scan — $DATE $(date +%H:%M) CT

Actions: N
• Earnings-exit SYM @ \$X.XX — pre-print forced-close (BMO|AMC today)
• Cut SYM @ -X.X% (-\$XXX) — exchange stop missed, safety-net close
• Promoted SYM stop → trailing 10% (at +X.X%)
• Tightened SYM trail 10% → 7% (at +X.X%)
• Cut SYM (thesis break: <one-liner>)

📊 Open: N positions | 💰 Cash: \$X"

If no actions were taken:
  bash scripts/discord.sh --type=midday "🎯 Late-morning scan — $DATE $(date +%H:%M) CT

No actions taken — all positions within rules.
• SYM ±X.X% (stop \$X.XX)
• SYM ±X.X% (stop \$X.XX)"

If there are no open positions at all, end the second template with
"No open positions." instead of the bullet list.

The post is mandatory either way — no silent runs.
<!-- STEPS-END -->
