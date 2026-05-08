---
description: Manual trade helper with strategy-rule validation. Usage — /trade SYMBOL SHARES buy|sell
---

Execute a manual trade with full rule validation. Refuse if any rule fails.

Args: SYMBOL SHARES SIDE (buy or sell). If missing, ask.

0. **Active strategy parameters** — resolve from env vars exported by the
   per-bot loop (or use safe defaults matching rule #14, #17, #19, #12).
   Source `scripts/_routine-header.sh` and call
   `_routine_export_strategy_params` if you want to trade against a non-
   `default` strategy locally; otherwise the defaults below kick in.

   ```bash
   SECTOR_CAP=${STRATEGY_SECTOR_CAP:-3}
   MAX_OPEN_POSITIONS=${STRATEGY_MAX_OPEN_POSITIONS:-6}
   ENTRY_SCORE_MIN=${STRATEGY_ENTRY_SCORE_MIN:-7}
   EARNINGS_GATE_DAYS=${STRATEGY_EARNINGS_GATE_DAYS:-2}
   DAY_BREAKER_DEC=$(awk -v p="${STRATEGY_DAY_BREAKER_PCT:--2}" 'BEGIN{printf "%.4f", p/100}')
   WEEK_BREAKER_DEC=$(awk -v p="${STRATEGY_WEEK_BREAKER_PCT:--4}" 'BEGIN{printf "%.4f", p/100}')
   conviction_pct() {
     local score="$1"
     if [[ -n "${STRATEGY_CONVICTION_TABLE_JSON:-}" ]]; then
       local v
       v=$(printf '%s' "$STRATEGY_CONVICTION_TABLE_JSON" | jq -r ".[] | select(.k == $score) | .v" 2>/dev/null)
       if [[ -n "$v" && "$v" != "null" ]]; then awk -v v="$v" 'BEGIN{printf "%.4f", v/100}'; return; fi
     fi
     case "$score" in 7) echo 0.12 ;; 8) echo 0.15 ;; 9) echo 0.18 ;; 10) echo 0.20 ;; *) echo 0.00 ;; esac
   }
   echo "strategy=${STRATEGY:-default} sector_cap=$SECTOR_CAP max_open=$MAX_OPEN_POSITIONS entry_score_min=$ENTRY_SCORE_MIN earnings_gate_days=$EARNINGS_GATE_DAYS day_breaker=$DAY_BREAKER_DEC week_breaker=$WEEK_BREAKER_DEC"
   ```

1. Pull state: account, positions, quote SYMBOL (capture bid bp, ask ap).
2. For BUY, validate (in this order — STOP and print failed checks if any fail):
   - Drawdown circuit breaker (rule #14): compute day_pl and week_pl from
     account.equity (live) minus the most recent EOD-snapshot equity in
     memory/${BOT_MODE:-live}/${STRATEGY:-default}/BENCHMARK.md. REFUSE if day_pl < $DAY_BREAKER_DEC OR week_pl < $WEEK_BREAKER_DEC (default -0.02 / -0.04 from STEP 0).
     Print "BLOCKED: drawdown circuit breaker tripped (day X.X%, week Y.Y%)".
   - Earnings gate (rule #13): read memory/${BOT_MODE:-live}/${STRATEGY:-default}/EARNINGS-CALENDAR.md row for
     SYMBOL. If `Next Earnings Date` is within $EARNINGS_GATE_DAYS
     trading days of today (default 2 from STEP 0), REFUSE. Print
     "BLOCKED: earnings within $EARNINGS_GATE_DAYS trading days
     ($earnings_date $bmo_amc)". If row missing, query perplexity.sh and
     append to EARNINGS-CALENDAR.md before re-checking.
   - Total positions after fill <= $MAX_OPEN_POSITIONS (default 6 from STEP 0)
   - Trades this week + 1 <= 3
   - SHARES * ask <= conviction-weighted target (rule #19): compute
     target_pct via `conviction_pct $score` (helper in STEP 0). Defaults:
     7→12%, 8→15%, 9→18%, 10→20%. Custom strategies override via
     STRATEGY_CONVICTION_TABLE_JSON. REFUSE if SHARES * ask >
     equity * target_pct. Print "BLOCKED: position size $X exceeds
     conviction target $Y (score N → cap N%)".
   - SHARES * ask <= available cash
   - daytrade_count < 3
   - Volatility regime gate: query VIX via
       bash scripts/perplexity.sh "current VIX index level today"
     If VIX >= 25, REFUSE the trade and print "BLOCKED: VIX $X >= 25
     (high-volatility regime — wait for VIX < 22 before opening new risk)".
     This replaces the old standalone /risk command.
   - Catalyst documented (ask for thesis if not in today's RESEARCH-LOG)
   - Sector rotation: look up SYMBOL's sector in memory/shared/SECTOR-MAP.md.
     If unknown, run perplexity.sh "What is the GICS sector for $SYMBOL?"
     and append the answer to SECTOR-MAP.md. Then read memory/${BOT_MODE:-live}/${STRATEGY:-default}/SECTOR-LEDGER.md
     and refuse the trade if this sector has 2+ consecutive losses in last
     30 days. Print "BLOCKED: sector rotation rule (last 2 X-sector trades
     were losses)".
   - Sector concentration (rule #17): count open positions by sector via
     SECTOR-MAP.md. REFUSE if this entry would push that sector to >
     $SECTOR_CAP positions (default 3 from STEP 0). Print "BLOCKED: sector
     concentration cap reached ($SECTOR_CAP/$SECTOR_CAP in $sector)".
   - Re-entry guard (rule #20): grep memory/${BOT_MODE:-live}/${STRATEGY:-default}/SECTOR-LEDGER.md for closed
     trades of SYMBOL with outcome `L` in the last 3 trading days. If
     found AND today's RESEARCH-LOG has no fresh dated catalyst for
     SYMBOL (added today, distinct from the prior thesis), REFUSE.
     Print "BLOCKED: re-entry cooldown (stopped out YYYY-MM-DD, no new
     catalyst)".
   - Entry Scorer (rubric in memory/${BOT_MODE:-live}/${STRATEGY:-default}/TRADING-STRATEGY.md): score 1-10 each:
       catalyst (clarity + freshness)
       momentum (price + sector trend)
       risk_reward (target / stop distance, must be >= 2:1)
       stop_distance (room above last support, not within 3% of entry)
     Compute total = round((catalyst + momentum + risk_reward + stop_distance) / 4).
     If total < $ENTRY_SCORE_MIN, REFUSE the trade (default 7 from STEP 0).
     Print the rubric and scores so the user can see why.
3. For SELL, confirm position exists with right qty. No other checks.
4. Choose order type (BUY only):
     mid = (bp + ap) / 2; spread_bps = (ap - bp) / mid * 10000
     if spread_bps > 50: order_type = market   # illiquid -> market is safer
     else:                order_type = limit    # default
     limit_price = round(mid * 1.001, 2)         # midpoint + 10 bps
   Print:
     Order: BUY N SYM @ <market | limit $X.XX> day TIF
     Validation: PASS / FAIL: <reason>
     Sector: X-sector (last-2 outcomes from ledger)
     Entry score: catalyst=X momentum=X rr=X stop=X total=X/10
   Ask "execute? (y/n)".
5. On confirm:
     bash scripts/alpaca.sh submit-order --symbol SYM --qty N --side buy --type <market|limit> [--limit-price X.XX] --tif day
6. For BUYs, immediately place a fixed -7% stop-limit GTC (rule #4 caps
   slippage to -8%). Compute:
     stop_price  = round(fill_price * 0.93, 2)
     limit_price = round(fill_price * 0.92, 2)
   The intraday routines will PATCH this into a 10% trailing stop once
   the position is green.
     bash scripts/alpaca.sh submit-order --symbol SYM --qty N --side sell --type stop_limit --stop-price X.XX --limit-price Y.YY --tif gtc
7. Log to memory/${BOT_MODE:-live}/${STRATEGY:-default}/TRADE-LOG.md with full thesis, entry, stop, target, R:R,
   sector, and the entry-scorer JSON block:
     entry_scorer: {catalyst:X, momentum:X, risk_reward:X, stop_distance:X, total:X/10}
8. For SELLs, append a closed-trade row to memory/${BOT_MODE:-live}/${STRATEGY:-default}/SECTOR-LEDGER.md with
   the realized outcome (W/L) so rule #10 stays accurate.
9. bash scripts/discord.sh --type=fill with trade details.
