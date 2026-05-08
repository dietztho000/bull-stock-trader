---
description: Stop-management routine. Reconciles every open position against its live trailing-stop GTC order, replaces drifted stops in place.
---

You are running the stop-reconciliation workflow LOCALLY. Resolve today's date via:
DATE=$(date +%Y-%m-%d).

Credentials come from the local .env. No env-var check block. No commit/push step.

This is the SAFETY-NET routine. The strategy's whole risk model assumes a real
trailing-stop GTC order exists for every long position; this routine verifies
that assumption. NEVER run within 5 minutes of the close — order replacement
during low-liquidity windows can briefly leave a position un-stopped.

**LOCAL fan-out** — when invoked via `/stops`, source the registry
helpers and run the per-bot loop yourself. Cloud routines get this same
logic from `routines/_cloud-header.md` (do not duplicate inside STEPS):

```bash
DATE=$(date +%Y-%m-%d)
source scripts/_routine-header.sh
_routine_assert_bots_present stops
_routine_emit_start stops
while IFS=$'\t' read -r BOT_ID ACCOUNT_ID STRATEGY BOT_ALLOCATION BOT_MODE STRATEGY_PARAMS_JSON; do
  [[ "$BOT_ALLOCATION" == "null" ]] && BOT_ALLOCATION=""
  export BOT_ID ACCOUNT_ID STRATEGY BOT_ALLOCATION BOT_MODE STRATEGY_PARAMS_JSON
  _routine_export_strategy_params
  _routine_preflight_or_skip stops || continue
  # — STEPS 1..N below execute per bot —
done < <(bash scripts/bots.sh list --routine=stops)
_routine_emit_end stops ok
```

The stop-mechanics literals (-7% trigger, -8% slippage floor, +1%
promotion threshold, 10/7/5% trail ratchet, +20% take-profit ladder)
are now first-class strategy params. STEP 0 below resolves them from
env vars exported by the per-bot loop, with safe defaults that match
rule #4 / #6 / #16 byte-for-byte.

<!-- STEPS-BEGIN -->

STEP 0 — **Active stop-management parameters**.

```bash
STOP_TRIGGER_PCT=${STRATEGY_STOP_TRIGGER_PCT:--7}
STOP_LIMIT_PCT=${STRATEGY_STOP_LIMIT_PCT:--8}
STOP_TRIGGER_FACTOR=$(awk -v p="$STOP_TRIGGER_PCT" 'BEGIN{printf "%.4f", 1 + p/100}')
STOP_LIMIT_FACTOR=$(awk -v p="$STOP_LIMIT_PCT" 'BEGIN{printf "%.4f", 1 + p/100}')
TRAIL_PROMOTION_DEC=$(awk -v p="${STRATEGY_TRAIL_PROMOTION_PCT:-1}" 'BEGIN{printf "%.4f", p/100}')
TRAIL_INITIAL=${STRATEGY_TRAIL_INITIAL_PCT:-10}
TRAIL_TIGHTEN_15_TRIGGER_DEC=$(awk -v p="${STRATEGY_TRAIL_TIGHTEN_15_TRIGGER_PCT:-15}" 'BEGIN{printf "%.4f", p/100}')
TRAIL_TIGHTEN_15=${STRATEGY_TRAIL_TIGHTEN_15_PCT:-7}
TRAIL_TIGHTEN_20_TRIGGER_DEC=$(awk -v p="${STRATEGY_TRAIL_TIGHTEN_20_TRIGGER_PCT:-20}" 'BEGIN{printf "%.4f", p/100}')
TRAIL_TIGHTEN_20=${STRATEGY_TRAIL_TIGHTEN_20_PCT:-5}
TAKE_PROFIT_LADDER_DEC=$(awk -v p="${STRATEGY_TAKE_PROFIT_LADDER_PCT:-20}" 'BEGIN{printf "%.4f", p/100}')
echo "[$BOT_ID] strategy=$STRATEGY stop_trigger=${STOP_TRIGGER_PCT}% stop_limit=${STOP_LIMIT_PCT}% trail_promote=$TRAIL_PROMOTION_DEC trail_initial=${TRAIL_INITIAL}% trail_15=${TRAIL_TIGHTEN_15}%@$TRAIL_TIGHTEN_15_TRIGGER_DEC trail_20=${TRAIL_TIGHTEN_20}%@$TRAIL_TIGHTEN_20_TRIGGER_DEC take_profit=$TAKE_PROFIT_LADDER_DEC"
```

STEP 1 — Confirm the market is open and >5 min from close:
  bash scripts/alpaca.sh --account-id="$ACCOUNT_ID" --bot-id="$BOT_ID" clock
If `is_open` is false, exit silently (nothing to reconcile).
If now is within 5 min of `next_close`, exit with a Discord error
notification "stops: skipped — too close to close".

STEP 2 — Pull the state to reconcile:
  bash scripts/alpaca.sh --account-id="$ACCOUNT_ID" --bot-id="$BOT_ID" positions
  bash scripts/alpaca.sh --account-id="$ACCOUNT_ID" --bot-id="$BOT_ID" orders open

STEP 3 — For every open LONG position, verify exactly one stop GTC order
exists for that symbol. The expected type depends on whether the position
is green yet:
- 0 stops -> CRITICAL. Branch on profit state:
    if unrealized_plpc < $TRAIL_PROMOTION_DEC (default +0.01 from STEP 0):
      stop_price  = round(entry_price * $STOP_TRIGGER_FACTOR, 2)   # default 0.93 = -7% trigger
      limit_price = round(entry_price * $STOP_LIMIT_FACTOR, 2)     # default 0.92 = -8% slippage floor
      bash scripts/alpaca.sh --account-id="$ACCOUNT_ID" --bot-id="$BOT_ID" submit-order --symbol SYM --qty N --side sell --type stop_limit --stop-price X.XX --limit-price Y.YY --tif gtc
      Discord error: "stops: missing on SYM, placed ${STOP_TRIGGER_PCT}% stop-limit".
    else:
      bash scripts/alpaca.sh --account-id="$ACCOUNT_ID" --bot-id="$BOT_ID" submit-order --symbol SYM --qty N --side sell --type trailing_stop --trail-percent $TRAIL_INITIAL --tif gtc
      Discord error: "stops: missing on SYM, placed ${TRAIL_INITIAL}% trail (already green)".
- 2+ stops -> cancel the older one(s), keep the most recent:
    bash scripts/alpaca.sh --account-id="$ACCOUNT_ID" --bot-id="$BOT_ID" cancel ORDER_ID
- 1 stop -> proceed to STEP 4.

STEP 4 — Reconcile the stop type and trail-percent against the rule table.
Apply the FIRST matching row:
- stop.type IN {"stop", "stop_limit"} AND unrealized_plpc >= $TRAIL_PROMOTION_DEC ->
    PATCH to trailing $TRAIL_INITIAL% (default 10%):
    bash scripts/alpaca.sh --account-id="$ACCOUNT_ID" --bot-id="$BOT_ID" replace-order ORDER_ID --trail-percent $TRAIL_INITIAL
  (Promotion: position graduated from fixed ${STOP_TRIGGER_PCT}% floor to ratcheting trail.)
- stop.type IN {"stop", "stop_limit"} AND unrealized_plpc <  $TRAIL_PROMOTION_DEC ->
    leave the fixed stop alone (Alpaca enforces ${STOP_TRIGGER_PCT}% from entry autonomously).
- stop.type == "trailing_stop": run the trail-tighten ratchet (defaults
  match rule #6 — registry can override per strategy):
    unrealized_plpc >= $TRAIL_TIGHTEN_20_TRIGGER_DEC -> required trail = $TRAIL_TIGHTEN_20%
    unrealized_plpc >= $TRAIL_TIGHTEN_15_TRIGGER_DEC -> required trail = $TRAIL_TIGHTEN_15%
    otherwise                                        -> required trail = $TRAIL_INITIAL%
  If actual trail differs from required AND replacement would not move the
  stop down, PATCH it in place:
    bash scripts/alpaca.sh --account-id="$ACCOUNT_ID" --bot-id="$BOT_ID" replace-order ORDER_ID --trail-percent $TRAIL_TIGHTEN_20
  If the new trail would put the stop within 3% of current price, SKIP
  and log "skipped: too close to current price". If Alpaca rejects with
  4xx ("would move stop down" or similar), log "skipped: would move down".

STEP 5 — For every SHORT position (if any ever exist — the strategy is
long-only, but be defensive), log "WARNING: short position SYM has no
stop reconciliation rule" and notify.

STEP 6 — Append a single reconciliation row to memory/$BOT_ID/$STRATEGY/TRADE-LOG.md ONLY
if any stops were modified, placed, or canceled. Format:
  ### MMM DD HH:MM — Stop reconciliation
  - SYM: trail 10% -> 7% (at +16.2%)
  - SYM: missing stop placed (10%)
  - SYM: skipped (would move down)

STEP 7 — ALWAYS post a stop-reconciliation summary to the stops channel.

If any stop was placed/modified/canceled (build a bullet per change):
  bash scripts/discord.sh --type=stops "🛡️ Stop reconciliation — $DATE $(TZ=America/Chicago date +%H:%M) CT

Stops checked: N
• SYM: promoted fixed -7% → trail 10% (at +X.X%)
• SYM: trail 10% → 7% (at +X.X%)
• SYM: missing stop placed (-7% stop-limit | trail 10%)
• SYM: skipped (would move down)

✓ All positions stopped correctly."

If everything was already correct (no changes made):
  bash scripts/discord.sh --type=stops "🛡️ Stop reconciliation — $DATE $(TZ=America/Chicago date +%H:%M) CT

Stops checked: N
• SYM: stop-limit -7% (no change, X.X%)
• SYM: trail 10% (no change, +X.X%)
• SYM: trail 7% (no change, +16.2%)

✓ All positions stopped correctly."

If the routine exited early (market closed or within 5 min of close):
  bash scripts/discord.sh --type=stops "🛡️ Stop reconciliation — $DATE $(TZ=America/Chicago date +%H:%M) CT

Skipped: <market closed | within 5 min of close — order replacement unsafe in low-liquidity windows>"

The post is mandatory — even on early exit, the user gets confirmation
the routine ran.
<!-- STEPS-END -->
