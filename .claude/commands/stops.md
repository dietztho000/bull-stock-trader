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
STEP 1 — Confirm the market is open and >5 min from close:
  bash scripts/alpaca.sh clock
If `is_open` is false, exit silently (nothing to reconcile).
If now is within 5 min of `next_close`, exit with a Discord error
notification "stops: skipped — too close to close".

STEP 2 — Pull the state to reconcile:
  bash scripts/alpaca.sh positions
  bash scripts/alpaca.sh orders open

STEP 3 — For every open LONG position, verify exactly one trailing-stop
GTC order exists for that symbol:
- 0 stops -> CRITICAL. Place one immediately:
    bash scripts/alpaca.sh submit-order --symbol SYM --qty N --side sell --type trailing_stop --trail-percent 10 --tif gtc
  Discord error: "stops: missing on SYM, placed 10% trail".
- 2+ stops -> cancel the older one(s), keep the most recent:
    bash scripts/alpaca.sh cancel ORDER_ID
- 1 stop -> proceed to STEP 4.

STEP 4 — Reconcile trail-percent against the rule table:
- unrealized_plpc >= +0.20 -> required trail = 5%
- unrealized_plpc >= +0.15 -> required trail = 7%
- otherwise                  -> required trail = 10%
If actual trail differs from required AND replacement would not move the
stop down, PATCH it in place:
  bash scripts/alpaca.sh replace-order ORDER_ID --trail-percent 5
If the new trail would put the stop within 3% of current price, SKIP and
log "skipped: too close to current price". If Alpaca rejects the PATCH
with 4xx ("would move stop down" or similar), log "skipped: would move down".

STEP 5 — For every SHORT position (if any ever exist — the strategy is
long-only, but be defensive), log "WARNING: short position SYM has no
stop reconciliation rule" and notify.

STEP 6 — Append a single reconciliation row to memory/TRADE-LOG.md ONLY
if any stops were modified, placed, or canceled. Format:
  ### MMM DD HH:MM — Stop reconciliation
  - SYM: trail 10% -> 7% (at +16.2%)
  - SYM: missing stop placed (10%)
  - SYM: skipped (would move down)

STEP 7 — ALWAYS post a stop-reconciliation summary to the stops channel.

If any stop was placed/modified/canceled (build a bullet per change):
  bash scripts/discord.sh --type=stops "🛡️ Stop reconciliation — $DATE $(date +%H:%M) CT

Stops checked: N
• SYM: trail 10% → 7% (at +X.X%)
• SYM: missing stop placed (10%)
• SYM: skipped (would move down)

✓ All positions stopped correctly."

If everything was already correct (no changes made):
  bash scripts/discord.sh --type=stops "🛡️ Stop reconciliation — $DATE $(date +%H:%M) CT

Stops checked: N
• SYM: trail 10% (no change, +X.X%)
• SYM: trail 7% (no change, +16.2%)

✓ All positions stopped correctly."

If the routine exited early (market closed or within 5 min of close):
  bash scripts/discord.sh --type=stops "🛡️ Stop reconciliation — $DATE $(date +%H:%M) CT

Skipped: <market closed | within 5 min of close — order replacement unsafe in low-liquidity windows>"

The post is mandatory — even on early exit, the user gets confirmation
the routine ran.
<!-- STEPS-END -->
