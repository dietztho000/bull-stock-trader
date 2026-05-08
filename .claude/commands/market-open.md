---
description: Local market-open execution workflow. Validates today's trade plan against hard rules, places buys + 10% trailing stops.
---

You are running the market-open execution workflow LOCALLY. Resolve today's date via:
DATE=$(date +%Y-%m-%d).

Credentials come from the local .env. No env-var check block. No commit/push step.

**LOCAL fan-out** — when invoked via `/market-open`, source the registry
helpers and run the per-bot loop yourself. Cloud routines get this same
logic from `routines/_cloud-header.md` (do not duplicate inside STEPS):

```bash
DATE=$(date +%Y-%m-%d)
source scripts/_routine-header.sh
_routine_assert_bots_present market-open
_routine_emit_start market-open
while IFS=$'\t' read -r BOT_ID ACCOUNT_ID STRATEGY BOT_ALLOCATION BOT_MODE STRATEGY_PARAMS_JSON; do
  [[ "$BOT_ALLOCATION" == "null" ]] && BOT_ALLOCATION=""
  export BOT_ID ACCOUNT_ID STRATEGY BOT_ALLOCATION BOT_MODE STRATEGY_PARAMS_JSON
  _routine_export_strategy_params
  _routine_preflight_or_skip market-open || continue
  # — STEPS 1..N below execute per bot —
done < <(bash scripts/bots.sh list --routine=market-open)
_routine_emit_end market-open ok
```

<!-- STEPS-BEGIN -->

STEP 0 — **Active strategy parameters** (multi-strategy upgrade, Phase 4).
Resolve the per-bot strategy values from env vars exported by the
fan-out loop. Defaults are byte-for-byte the legacy literals — a `default`-
strategy bot with no registry edits behaves exactly as before. Reference
these resolved variables in the gating logic below; the rule numbers in
prose still match TRADING-STRATEGY.md.

```bash
SECTOR_CAP=${STRATEGY_SECTOR_CAP:-3}
MAX_OPEN_POSITIONS=${STRATEGY_MAX_OPEN_POSITIONS:-6}
ENTRY_SCORE_MIN=${STRATEGY_ENTRY_SCORE_MIN:-7}
EARNINGS_GATE_DAYS=${STRATEGY_EARNINGS_GATE_DAYS:-2}
DAY_BREAKER_DEC=$(awk -v p="${STRATEGY_DAY_BREAKER_PCT:--2}" 'BEGIN{printf "%.4f", p/100}')
WEEK_BREAKER_DEC=$(awk -v p="${STRATEGY_WEEK_BREAKER_PCT:--4}" 'BEGIN{printf "%.4f", p/100}')
echo "[$BOT_ID] strategy=$STRATEGY sector_cap=$SECTOR_CAP max_open=$MAX_OPEN_POSITIONS entry_score_min=$ENTRY_SCORE_MIN earnings_gate_days=$EARNINGS_GATE_DAYS day_breaker=$DAY_BREAKER_DEC week_breaker=$WEEK_BREAKER_DEC"
# Conviction-table lookup helper. Use as: pct=$(conviction_pct $score)
# Returns the position-size FRACTION (0.12, 0.15, 0.18, 0.20) keyed by
# entry-scorer total. Defaults match rule #19 exactly.
conviction_pct() {
  local score="$1"
  if [[ -n "${STRATEGY_CONVICTION_TABLE_JSON:-}" ]]; then
    local v
    v=$(printf '%s' "$STRATEGY_CONVICTION_TABLE_JSON" | jq -r ".[] | select(.k == $score) | .v" 2>/dev/null)
    if [[ -n "$v" && "$v" != "null" ]]; then
      awk -v v="$v" 'BEGIN{printf "%.4f", v/100}'
      return
    fi
  fi
  case "$score" in
    7)  echo 0.12 ;;
    8)  echo 0.15 ;;
    9)  echo 0.18 ;;
    10) echo 0.20 ;;
    *)  echo 0.00 ;;
  esac
}
```

STEP 1 — Read memory for today's plan:
- memory/$BOT_ID/$STRATEGY/TRADING-STRATEGY.md
- TODAY's entry in memory/$BOT_ID/$STRATEGY/RESEARCH-LOG.md. If missing, run pre-market
  STEPS 1-4 inline — STEP 4 is critical: write the dated entry to
  memory/$BOT_ID/$STRATEGY/RESEARCH-LOG.md so later routines (midday, daily-summary) can
  read it instead of re-running Perplexity. Make sure RESEARCH-LOG.md
  is included in the FINAL STEP commit when this fallback fires.
- tail of memory/$BOT_ID/$STRATEGY/TRADE-LOG.md (for weekly trade count)
- memory/$BOT_ID/$STRATEGY/SECTOR-LEDGER.md (rule #10 — 2-loss streak by sector blocks new trades)
- memory/$BOT_ID/$STRATEGY/EARNINGS-CALENDAR.md (rule #13 — earnings gate)
- tail of memory/$BOT_ID/$STRATEGY/BENCHMARK.md (rule #14 — drawdown circuit breaker)

STEP 2 — Re-validate with live data:
  bash scripts/alpaca.sh --account-id="$ACCOUNT_ID" --bot-id="$BOT_ID" account
  bash scripts/alpaca.sh --account-id="$ACCOUNT_ID" --bot-id="$BOT_ID" positions
  bash scripts/alpaca.sh --account-id="$ACCOUNT_ID" --bot-id="$BOT_ID" quote <each planned ticker>

STEP 2c — Compute the bot's effective equity for sizing.
  - If $BOT_ALLOCATION is set (a non-empty number from bots.sh), this bot
    is soft-allocated a slice of a shared account. Use the slice as the
    sizing base, NOT raw account.equity (which reflects the union of all
    bots on that account):
      effective_equity = $BOT_ALLOCATION
    The bot's actual buying power against that slice = allocation minus
    the cost basis of its OWN tagged positions (filter Alpaca positions
    by entry-order client_order_id starting with "${BOT_ID}-"). For the
    remaining STEPs, treat $effective_equity as the account-equity number
    in every "% of equity" rule below.
  - If $BOT_ALLOCATION is empty (bot uses the entire account), use
    account.equity from STEP 2 directly:
      effective_equity = account.equity
  - Echo the chosen value to the run log:
      echo "[$BOT_ID] effective_equity=\$$effective_equity allocation=${BOT_ALLOCATION:-full-account}"

STEP 2b — Pre-market gap check (rule #15). For each currently open
position, fetch the last 2 daily bars and compute:
  bash scripts/alpaca.sh --account-id="$ACCOUNT_ID" --bot-id="$BOT_ID" bars SYM 1Day "" "" 2
  gap = (today_open - yesterday_close) / yesterday_close
If gap <= -0.07, the GTC stop-limit may not have filled (true crash gap).
Force-exit at market BEFORE placing any new entries:
  bash scripts/alpaca.sh --account-id="$ACCOUNT_ID" --bot-id="$BOT_ID" positions   # confirm still open
  bash scripts/alpaca.sh --account-id="$ACCOUNT_ID" --bot-id="$BOT_ID" close SYM
  bash scripts/alpaca.sh --account-id="$ACCOUNT_ID" --bot-id="$BOT_ID" cancel ORDER_ID   # cancel its stop
Log to TRADE-LOG: "exit: pre-market gap ($gap_pct%) — stop-limit didn't fire".
Append a closed-trade row to memory/$BOT_ID/$STRATEGY/SECTOR-LEDGER.md with realized outcome.
Note these exits in the Discord post for STEP 7 alongside any new fills.

STEP 3a — Drawdown circuit breaker (rule #14). Compute:
  current_equity = $effective_equity (from STEP 2c)
  yesterday_equity = portfolio column of the most recent EOD row in BENCHMARK.md
                     (BENCHMARK is per-bot, so for soft-allocated bots this is
                     already the bot's virtual equity history, not the account's)
  week_start_equity = portfolio column of the BENCHMARK.md row whose date
                      is the most recent Monday on/before today (or earliest
                      row if Monday is missing)
  day_pl = (current_equity - yesterday_equity) / yesterday_equity
  week_pl = (current_equity - week_start_equity) / week_start_equity
If day_pl < $DAY_BREAKER_DEC OR week_pl < $WEEK_BREAKER_DEC (resolved in
STEP 0; defaults -0.02 / -0.04), REFUSE all entries today. Post Discord
error and skip to FINAL STEP:
  bash scripts/discord.sh --type=fill "🛑 Drawdown circuit breaker tripped — day $(printf '%.2f' day_pl_pct)%, week $(printf '%.2f' week_pl_pct)%. No new entries today (rule #14)."
Then jump to STEP 7's NO-TRADES branch with reason 'drawdown circuit breaker
tripped'.

STEP 3 — Hard-check rules BEFORE every order. Skip any trade that fails
and log the reason:
- Total positions after trade <= $MAX_OPEN_POSITIONS (default 6, resolved in STEP 0)
- Trades this week <= 3
- Position cost <= conviction-weighted target (rule #19): compute
  target_pct via the `conviction_pct $score` helper from STEP 0.
  Defaults match the legacy table:
    score 7  -> target_pct = 0.12 (12% of effective_equity)
    score 8  -> target_pct = 0.15
    score 9  -> target_pct = 0.18
    score 10 -> target_pct = 0.20
  Custom strategies override these via STRATEGY_CONVICTION_TABLE_JSON
  (a registry `table` param keyed by entry-score total → percent value).
  Cap qty so `qty * ask <= effective_equity * target_pct` (where
  effective_equity is the slice value from STEP 2c — bot allocation when
  soft-sliced, else raw account equity). The position MUST also fit under
  the absolute 20% ceiling. Log the chosen target_pct AND the
  effective_equity in the entry-scorer block of TRADE-LOG so the
  dashboard can show actual vs target — and so reviewers can see whether
  the slice or the full account drove sizing.
- Catalyst documented in today's RESEARCH-LOG
- daytrade_count leaves room (PDT: 3/5 rolling business days)
- Sector for this ticker has < 2 consecutive losses in last 30 days
  (read memory/$BOT_ID/$STRATEGY/SECTOR-LEDGER.md). If sector is unknown, look it up via
  perplexity.sh "What is the GICS sector for $TICKER?", cache the answer
  in memory/shared/SECTOR-MAP.md, then re-check.
- Sector concentration (rule #17): count current open positions by GICS
  sector via memory/shared/SECTOR-MAP.md. REFUSE this entry if the new trade
  would push that sector to > $SECTOR_CAP positions (default 3, resolved
  in STEP 0). Log "BLOCKED: sector concentration cap reached
  ($SECTOR_CAP/$SECTOR_CAP in $sector)".
- Re-entry guard (rule #20): grep memory/$BOT_ID/$STRATEGY/SECTOR-LEDGER.md for closed-
  trade rows of $TICKER with outcome `L` in the last 3 trading days.
  If found AND no fresh dated catalyst for $TICKER appears in today's
  RESEARCH-LOG.md (i.e., the catalyst block must have been added today
  with a date >= prior stop-out), REFUSE this entry. Log "BLOCKED:
  re-entry cooldown (stopped out YYYY-MM-DD, no new catalyst)".
- Earnings gate (rule #13): read memory/$BOT_ID/$STRATEGY/EARNINGS-CALENDAR.md row for
  $TICKER. If `Next Earnings Date` is within $EARNINGS_GATE_DAYS trading
  days of today (default 2, resolved in STEP 0 — i.e., today, tomorrow,
  or day-after when day-after is a trading day for the default), REFUSE
  this entry. Log "BLOCKED: earnings within $EARNINGS_GATE_DAYS trading
  days ($earnings_date $bmo_amc)". If the row is missing, fall back to a
  fresh perplexity.sh query and append to EARNINGS-CALENDAR.md
  (idempotent grep-and-replace by Symbol).
- Entry scorer (see TRADING-STRATEGY.md "Entry Scorer"): each trade must
  score >= $ENTRY_SCORE_MIN/10 across catalyst, momentum, R:R,
  stop-distance (default 7, resolved in STEP 0). Record the score block
  in TRADE-LOG before STEP 4.

STEP 4 — Execute the buys. Default to a marketable LIMIT at midpoint
+ 10 bps to reduce slippage on small-cap names; fall back to MARKET if
spread > 50 bps (illiquid name = market is safer):
  # quote SYM gives bid (bp) and ask (ap)
  mid = (bp + ap) / 2; spread_bps = (ap - bp) / mid * 10000
  if spread_bps > 50:
    bash scripts/alpaca.sh --account-id="$ACCOUNT_ID" --bot-id="$BOT_ID" submit-order --symbol SYM --qty N --side buy --type market --tif day
  else:
    limit = round(mid * 1.001, 2)   # midpoint + 10 bps
    bash scripts/alpaca.sh --account-id="$ACCOUNT_ID" --bot-id="$BOT_ID" submit-order --symbol SYM --qty N --side buy --type limit --limit-price LIMIT --tif day
Wait for fill confirmation before placing the stop. If the limit is unfilled
at routine end, leave it — midday will escalate to market if still unfilled.

STEP 5 — Immediately place a fixed -7% **stop-limit** GTC for each new
position. The stop-limit caps slippage to ~1% past trigger (rule #4) — a
plain stop becomes a market order and can fill far below -7% in fast or
illiquid moves. Compute:
  stop_price  = round(fill_price * 0.93, 2)   # -7% trigger
  limit_price = round(fill_price * 0.92, 2)   # -8% slippage floor
  bash scripts/alpaca.sh --account-id="$ACCOUNT_ID" --bot-id="$BOT_ID" submit-order --symbol SYM --qty N --side sell --type stop_limit --stop-price X.XX --limit-price Y.YY --tif gtc
Once the position prints unrealized_plpc >= +1%, a later intraday routine
(mid-morning / midday / etc) PATCHes this stop into a 10% trailing stop —
that's where the trail-tighten ratchet (7% at +15%, 5% at +20%) takes over.
**Stop-limit caveat:** in a true crash gap (e.g., -15% overnight), the
limit may not fill at all and the position keeps falling. Phase 2's
pre-market gap check (STEP 1b) catches that case.
If Alpaca rejects (PDT or otherwise), queue the stop in TRADE-LOG as
"stop-blocked, set tomorrow AM" — never leave a position un-stopped silently.

STEP 6 — Append each trade to memory/$BOT_ID/$STRATEGY/TRADE-LOG.md (matching existing format):
Date, ticker, side, shares, entry price, stop level, thesis, target, R:R,
sector, entry-scorer JSON block.

STEP 7 — ALWAYS post a market-open summary to the fill channel. Branch
the format on whether any trades fired.

If trades fired (preserve format exactly — emojis, blank lines, bullets):
  bash scripts/discord.sh --type=fill "🟢 Market-open — $DATE $(TZ=America/Chicago date +%H:%M) CT

Trades placed: N
• SYM: BUY N @ \$X.XX (market|limit) — stop \$X.XX / limit \$Y.YY (fixed -7% stop-limit)
  Catalyst: <one-liner>
  Entry score: X/10 (cat:X mom:X r/r:X stop:X)

💰 Cash: \$X | Positions: N/$MAX_OPEN_POSITIONS | Trades this week: X/3"

If NO trades fired, post a short reason-coded confirmation:
  bash scripts/discord.sh --type=fill "🟢 Market-open — $DATE $(TZ=America/Chicago date +%H:%M) CT

No trades fired.
Reason: <pick the most specific match: 'drawdown circuit breaker tripped' | 'no actionable plan in RESEARCH-LOG' | 'VIX XX.X (>=25 regime gate)' | 'sector rotation block on SYM' | 'sector concentration cap (3/3 in SECTOR)' | 'earnings within 2 trading days on all ideas' | 'all ideas failed entry-scorer (<7)' | 'position cap reached (6/6)' | 'weekly trade cap reached (3/3)' | 'PDT block'>

💰 Cash: \$X | Positions: N/$MAX_OPEN_POSITIONS"

The post is mandatory either way — no silent runs.
<!-- STEPS-END -->
