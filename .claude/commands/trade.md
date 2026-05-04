---
description: Manual trade helper with strategy-rule validation. Usage — /trade SYMBOL SHARES buy|sell
---

Execute a manual trade with full rule validation. Refuse if any rule fails.

Args: SYMBOL SHARES SIDE (buy or sell). If missing, ask.

1. Pull state: account, positions, quote SYMBOL (capture bid bp, ask ap).
2. For BUY, validate (in this order — STOP and print failed checks if any fail):
   - Drawdown circuit breaker (rule #14): compute day_pl and week_pl from
     account.equity (live) minus the most recent EOD-snapshot equity in
     memory/${BOT_MODE:-live}/${STRATEGY:-default}/BENCHMARK.md. REFUSE if day_pl < -0.02 OR week_pl < -0.04.
     Print "BLOCKED: drawdown circuit breaker tripped (day X.X%, week Y.Y%)".
   - Earnings gate (rule #13): read memory/${BOT_MODE:-live}/${STRATEGY:-default}/EARNINGS-CALENDAR.md row for
     SYMBOL. If `Next Earnings Date` is within 2 trading days of today,
     REFUSE. Print "BLOCKED: earnings within 2 trading days
     ($earnings_date $bmo_amc)". If row missing, query perplexity.sh and
     append to EARNINGS-CALENDAR.md before re-checking.
   - Total positions after fill <= 6
   - Trades this week + 1 <= 3
   - SHARES * ask <= conviction-weighted target (rule #19): compute
     target_pct from the entry score you score in the validator below
     (7→12%, 8→15%, 9→18%, 10→20%). REFUSE if SHARES * ask >
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
     SECTOR-MAP.md. REFUSE if this entry would push that sector to > 3
     positions. Print "BLOCKED: sector concentration cap reached (3/3 in
     $sector)".
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
     If total < 7, REFUSE the trade. Print the rubric and scores so the
     user can see why.
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
