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

<!-- STEPS-BEGIN -->

PER-BOT FAN-OUT — every numbered STEP below runs ONCE PER ENABLED BOT.
Read the registry first:

  if [[ "$(bash scripts/bots.sh count)" == "0" ]]; then
    bash scripts/discord.sh --type=error "No enabled bots in registry — aborting stops"
    exit 0
  fi

  while IFS=$'	' read -r BOT_ID ACCOUNT_ID STRATEGY BOT_ALLOCATION BOT_MODE; do
    export BOT_ID ACCOUNT_ID STRATEGY BOT_ALLOCATION BOT_MODE
    # Per-account preflight: skip this bot if its account creds are bad.
    bash scripts/auth-preflight.sh stops --account-id="$ACCOUNT_ID" || continue
    # ─── run STEPS 1..N below for this bot ────────────────────────────
  done < <(bash scripts/bots.sh list)

Everything beneath this preamble runs inside that loop. $BOT_ID,
$ACCOUNT_ID, $STRATEGY, $BOT_ALLOCATION, and $BOT_MODE are guaranteed set.
Memory paths use $BOT_ID/$STRATEGY. Every alpaca.sh call already
includes --account-id="$ACCOUNT_ID" --bot-id="$BOT_ID".

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
    if unrealized_plpc < +0.01:
      stop_price  = round(entry_price * 0.93, 2)   # -7% trigger
      limit_price = round(entry_price * 0.92, 2)   # -8% slippage floor
      bash scripts/alpaca.sh --account-id="$ACCOUNT_ID" --bot-id="$BOT_ID" submit-order --symbol SYM --qty N --side sell --type stop_limit --stop-price X.XX --limit-price Y.YY --tif gtc
      Discord error: "stops: missing on SYM, placed -7% stop-limit".
    else:
      bash scripts/alpaca.sh --account-id="$ACCOUNT_ID" --bot-id="$BOT_ID" submit-order --symbol SYM --qty N --side sell --type trailing_stop --trail-percent 10 --tif gtc
      Discord error: "stops: missing on SYM, placed 10% trail (already green)".
- 2+ stops -> cancel the older one(s), keep the most recent:
    bash scripts/alpaca.sh --account-id="$ACCOUNT_ID" --bot-id="$BOT_ID" cancel ORDER_ID
- 1 stop -> proceed to STEP 4.

STEP 4 — Reconcile the stop type and trail-percent against the rule table.
Apply the FIRST matching row:
- stop.type IN {"stop", "stop_limit"} AND unrealized_plpc >= +0.01 ->
    PATCH to trailing 10%:
    bash scripts/alpaca.sh --account-id="$ACCOUNT_ID" --bot-id="$BOT_ID" replace-order ORDER_ID --trail-percent 10
  (Promotion: position graduated from fixed -7% floor to ratcheting trail.)
- stop.type IN {"stop", "stop_limit"} AND unrealized_plpc <  +0.01 ->
    leave the fixed stop alone (Alpaca enforces -7% from entry autonomously).
- stop.type == "trailing_stop": run the trail-tighten ratchet:
    unrealized_plpc >= +0.20 -> required trail = 5%
    unrealized_plpc >= +0.15 -> required trail = 7%
    otherwise                 -> required trail = 10%
  If actual trail differs from required AND replacement would not move the
  stop down, PATCH it in place:
    bash scripts/alpaca.sh --account-id="$ACCOUNT_ID" --bot-id="$BOT_ID" replace-order ORDER_ID --trail-percent 5
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
  bash scripts/discord.sh --type=stops "🛡️ Stop reconciliation — $DATE $(date +%H:%M) CT

Stops checked: N
• SYM: promoted fixed -7% → trail 10% (at +X.X%)
• SYM: trail 10% → 7% (at +X.X%)
• SYM: missing stop placed (-7% stop-limit | trail 10%)
• SYM: skipped (would move down)

✓ All positions stopped correctly."

If everything was already correct (no changes made):
  bash scripts/discord.sh --type=stops "🛡️ Stop reconciliation — $DATE $(date +%H:%M) CT

Stops checked: N
• SYM: stop-limit -7% (no change, X.X%)
• SYM: trail 10% (no change, +X.X%)
• SYM: trail 7% (no change, +16.2%)

✓ All positions stopped correctly."

If the routine exited early (market closed or within 5 min of close):
  bash scripts/discord.sh --type=stops "🛡️ Stop reconciliation — $DATE $(date +%H:%M) CT

Skipped: <market closed | within 5 min of close — order replacement unsafe in low-liquidity windows>"

The post is mandatory — even on early exit, the user gets confirmation
the routine ran.
<!-- STEPS-END -->
