---
description: Manual trade helper with strategy-rule validation. Usage — /trade SYMBOL SHARES buy|sell
---

Execute a manual trade with full rule validation. Refuse if any rule fails.

Args: SYMBOL SHARES SIDE (buy or sell). If missing, ask.

1. Pull state: account, positions, quote SYMBOL (capture bid bp, ask ap).
2. For BUY, validate (in this order — STOP and print failed checks if any fail):
   - Total positions after fill <= 6
   - Trades this week + 1 <= 3
   - SHARES * ask <= 20% of equity
   - SHARES * ask <= available cash
   - daytrade_count < 3
   - Volatility regime gate: query VIX via
       bash scripts/perplexity.sh "current VIX index level today"
     If VIX >= 25, REFUSE the trade and print "BLOCKED: VIX $X >= 25
     (high-volatility regime — wait for VIX < 22 before opening new risk)".
     This replaces the old standalone /risk command.
   - Catalyst documented (ask for thesis if not in today's RESEARCH-LOG)
   - Sector rotation: look up SYMBOL's sector in memory/SECTOR-MAP.md.
     If unknown, run perplexity.sh "What is the GICS sector for $SYMBOL?"
     and append the answer to SECTOR-MAP.md. Then read memory/SECTOR-LEDGER.md
     and refuse the trade if this sector has 2+ consecutive losses in last
     30 days. Print "BLOCKED: sector rotation rule (last 2 X-sector trades
     were losses)".
   - Entry Scorer (rubric in memory/TRADING-STRATEGY.md): score 1-10 each:
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
6. For BUYs, immediately place 10% trailing stop GTC:
     bash scripts/alpaca.sh submit-order --symbol SYM --qty N --side sell --type trailing_stop --trail-percent 10 --tif gtc
7. Log to memory/TRADE-LOG.md with full thesis, entry, stop, target, R:R,
   sector, and the entry-scorer JSON block:
     entry_scorer: {catalyst:X, momentum:X, risk_reward:X, stop_distance:X, total:X/10}
8. For SELLs, append a closed-trade row to memory/SECTOR-LEDGER.md with
   the realized outcome (W/L) so rule #10 stays accurate.
9. bash scripts/discord.sh --type=fill with trade details.
