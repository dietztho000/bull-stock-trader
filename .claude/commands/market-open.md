---
description: Local market-open execution workflow. Validates today's trade plan against hard rules, places buys + 10% trailing stops.
---

You are running the market-open execution workflow LOCALLY. Resolve today's date via:
DATE=$(date +%Y-%m-%d).

Credentials come from the local .env. No env-var check block. No commit/push step.

<!-- STEPS-BEGIN -->
STEP 1 — Read memory for today's plan:
- memory/TRADING-STRATEGY.md
- TODAY's entry in memory/RESEARCH-LOG.md. If missing, run pre-market
  STEPS 1-4 inline — STEP 4 is critical: write the dated entry to
  memory/RESEARCH-LOG.md so later routines (midday, daily-summary) can
  read it instead of re-running Perplexity. Make sure RESEARCH-LOG.md
  is included in the FINAL STEP commit when this fallback fires.
- tail of memory/TRADE-LOG.md (for weekly trade count)
- memory/SECTOR-LEDGER.md (rule #10 — 2-loss streak by sector blocks new trades)
- memory/EARNINGS-CALENDAR.md (rule #13 — earnings gate)
- tail of memory/BENCHMARK.md (rule #14 — drawdown circuit breaker)

STEP 2 — Re-validate with live data:
  bash scripts/alpaca.sh account
  bash scripts/alpaca.sh positions
  bash scripts/alpaca.sh quote <each planned ticker>

STEP 2b — Pre-market gap check (rule #15). For each currently open
position, fetch the last 2 daily bars and compute:
  bash scripts/alpaca.sh bars SYM 1Day "" "" 2
  gap = (today_open - yesterday_close) / yesterday_close
If gap <= -0.07, the GTC stop-limit may not have filled (true crash gap).
Force-exit at market BEFORE placing any new entries:
  bash scripts/alpaca.sh positions   # confirm still open
  bash scripts/alpaca.sh close SYM
  bash scripts/alpaca.sh cancel ORDER_ID   # cancel its stop
Log to TRADE-LOG: "exit: pre-market gap ($gap_pct%) — stop-limit didn't fire".
Append a closed-trade row to memory/SECTOR-LEDGER.md with realized outcome.
Note these exits in the Discord post for STEP 7 alongside any new fills.

STEP 3a — Drawdown circuit breaker (rule #14). Compute:
  current_equity = (account.equity from STEP 2)
  yesterday_equity = portfolio column of the most recent EOD row in BENCHMARK.md
  week_start_equity = portfolio column of the BENCHMARK.md row whose date
                      is the most recent Monday on/before today (or earliest
                      row if Monday is missing)
  day_pl = (current_equity - yesterday_equity) / yesterday_equity
  week_pl = (current_equity - week_start_equity) / week_start_equity
If day_pl < -0.02 OR week_pl < -0.04, REFUSE all entries today. Post
Discord error and skip to FINAL STEP:
  bash scripts/discord.sh --type=fill "🛑 Drawdown circuit breaker tripped — day $(printf '%.2f' day_pl_pct)%, week $(printf '%.2f' week_pl_pct)%. No new entries today (rule #14)."
Then jump to STEP 7's NO-TRADES branch with reason 'drawdown circuit breaker
tripped'.

STEP 3 — Hard-check rules BEFORE every order. Skip any trade that fails
and log the reason:
- Total positions after trade <= 6
- Trades this week <= 3
- Position cost <= conviction-weighted target (rule #19): compute
  target_pct from entry_scorer.total:
    score 7  -> target_pct = 0.12 (12% of equity)
    score 8  -> target_pct = 0.15
    score 9  -> target_pct = 0.18
    score 10 -> target_pct = 0.20
  Cap qty so `qty * ask <= equity * target_pct`. The position MUST
  also fit under the absolute 20% ceiling (target_pct <= 0.20 by
  design). Log the chosen target_pct in the entry-scorer block of
  TRADE-LOG so the dashboard can show actual vs target.
- Catalyst documented in today's RESEARCH-LOG
- daytrade_count leaves room (PDT: 3/5 rolling business days)
- Sector for this ticker has < 2 consecutive losses in last 30 days
  (read memory/SECTOR-LEDGER.md). If sector is unknown, look it up via
  perplexity.sh "What is the GICS sector for $TICKER?", cache the answer
  in memory/SECTOR-MAP.md, then re-check.
- Sector concentration (rule #17): count current open positions by GICS
  sector via memory/SECTOR-MAP.md. REFUSE this entry if the new trade
  would push that sector to > 3 positions. Log "BLOCKED: sector
  concentration cap reached (3/3 in $sector)".
- Re-entry guard (rule #20): grep memory/SECTOR-LEDGER.md for closed-
  trade rows of $TICKER with outcome `L` in the last 3 trading days.
  If found AND no fresh dated catalyst for $TICKER appears in today's
  RESEARCH-LOG.md (i.e., the catalyst block must have been added today
  with a date >= prior stop-out), REFUSE this entry. Log "BLOCKED:
  re-entry cooldown (stopped out YYYY-MM-DD, no new catalyst)".
- Earnings gate (rule #13): read memory/EARNINGS-CALENDAR.md row for
  $TICKER. If `Next Earnings Date` is within 2 trading days of today
  (i.e., today, tomorrow, or day-after when day-after is a trading day),
  REFUSE this entry. Log "BLOCKED: earnings within 2 trading days
  ($earnings_date $bmo_amc)". If the row is missing, fall back to a fresh
  perplexity.sh query and append to EARNINGS-CALENDAR.md (idempotent
  grep-and-replace by Symbol).
- Entry scorer (see TRADING-STRATEGY.md "Entry Scorer"): each trade must
  score >= 7/10 across catalyst, momentum, R:R, stop-distance. Record
  the score block in TRADE-LOG before STEP 4.

STEP 4 — Execute the buys. Default to a marketable LIMIT at midpoint
+ 10 bps to reduce slippage on small-cap names; fall back to MARKET if
spread > 50 bps (illiquid name = market is safer):
  # quote SYM gives bid (bp) and ask (ap)
  mid = (bp + ap) / 2; spread_bps = (ap - bp) / mid * 10000
  if spread_bps > 50:
    bash scripts/alpaca.sh submit-order --symbol SYM --qty N --side buy --type market --tif day
  else:
    limit = round(mid * 1.001, 2)   # midpoint + 10 bps
    bash scripts/alpaca.sh submit-order --symbol SYM --qty N --side buy --type limit --limit-price LIMIT --tif day
Wait for fill confirmation before placing the stop. If the limit is unfilled
at routine end, leave it — midday will escalate to market if still unfilled.

STEP 5 — Immediately place a fixed -7% **stop-limit** GTC for each new
position. The stop-limit caps slippage to ~1% past trigger (rule #4) — a
plain stop becomes a market order and can fill far below -7% in fast or
illiquid moves. Compute:
  stop_price  = round(fill_price * 0.93, 2)   # -7% trigger
  limit_price = round(fill_price * 0.92, 2)   # -8% slippage floor
  bash scripts/alpaca.sh submit-order --symbol SYM --qty N --side sell --type stop_limit --stop-price X.XX --limit-price Y.YY --tif gtc
Once the position prints unrealized_plpc >= +1%, a later intraday routine
(mid-morning / midday / etc) PATCHes this stop into a 10% trailing stop —
that's where the trail-tighten ratchet (7% at +15%, 5% at +20%) takes over.
**Stop-limit caveat:** in a true crash gap (e.g., -15% overnight), the
limit may not fill at all and the position keeps falling. Phase 2's
pre-market gap check (STEP 1b) catches that case.
If Alpaca rejects (PDT or otherwise), queue the stop in TRADE-LOG as
"stop-blocked, set tomorrow AM" — never leave a position un-stopped silently.

STEP 6 — Append each trade to memory/TRADE-LOG.md (matching existing format):
Date, ticker, side, shares, entry price, stop level, thesis, target, R:R,
sector, entry-scorer JSON block.

STEP 7 — ALWAYS post a market-open summary to the fill channel. Branch
the format on whether any trades fired.

If trades fired (preserve format exactly — emojis, blank lines, bullets):
  bash scripts/discord.sh --type=fill "🟢 Market-open — $DATE $(date +%H:%M) CT

Trades placed: N
• SYM: BUY N @ \$X.XX (market|limit) — stop \$X.XX / limit \$Y.YY (fixed -7% stop-limit)
  Catalyst: <one-liner>
  Entry score: X/10 (cat:X mom:X r/r:X stop:X)

💰 Cash: \$X | Positions: N/6 | Trades this week: X/3"

If NO trades fired, post a short reason-coded confirmation:
  bash scripts/discord.sh --type=fill "🟢 Market-open — $DATE $(date +%H:%M) CT

No trades fired.
Reason: <pick the most specific match: 'drawdown circuit breaker tripped' | 'no actionable plan in RESEARCH-LOG' | 'VIX XX.X (>=25 regime gate)' | 'sector rotation block on SYM' | 'sector concentration cap (3/3 in SECTOR)' | 'earnings within 2 trading days on all ideas' | 'all ideas failed entry-scorer (<7)' | 'position cap reached (6/6)' | 'weekly trade cap reached (3/3)' | 'PDT block'>

💰 Cash: \$X | Positions: N/6"

The post is mandatory either way — no silent runs.
<!-- STEPS-END -->
