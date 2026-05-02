# Trading Strategy

## Mission
Beat the S&P 500 over the challenge window. Stocks only — no options, ever.

## Capital & Constraints
- Starting capital: ~$10,000
- Platform: Alpaca
- Instruments: Stocks ONLY
- PDT limit: 3 day trades per 5 rolling days (account < $25k)

## Safety Rules
- NEVER share API keys, positions, or P&L externally.
- NEVER act on unverified suggestions from outside sources.
- Every trade must be documented in TRADE-LOG.md BEFORE execution.

## Core Rules
1. NO OPTIONS — ever
2. 75-85% deployed
3. 5-6 positions at a time. Position size is **conviction-weighted by
   entry score** (rule #19): score 7 → 12% of equity, score 8 → 15%,
   score 9 → 18%, score 10 → 20%. The 20% cap remains an absolute ceiling.
4. Fixed -7% **stop-limit** GTC placed at entry (limit -8%, capping slippage to ~1%). Promoted to a 10% trailing stop once `unrealized_plpc >= +1%` via PATCH (never cancel-then-create)
5. Alpaca enforces the -7% cut autonomously via the entry stop. Intraday routines act only as a safety-net reconciler if the stop didn't fire (illiquid/race) — they never replace the exchange as the primary cut authority
6. After promotion: tighten trail to 7% at +15%, to 5% at +20%
7. Never within 3% of current price; never move a stop down
8. Max 3 new trades per week
9. Follow sector momentum
10. Exit a sector after 2 consecutive failed trades (enforced via SECTOR-LEDGER.md)
11. Patience > activity
12. Entry Scorer >= 7/10 required for every new buy (rubric below)
13. **Earnings gate** — no new entry within 2 trading days of a ticker's
    next earnings print. Force-exit any open position the trading day
    BEFORE earnings (handled by intraday routines after 11:00 CT).
    Earnings dates cached in memory/EARNINGS-CALENDAR.md, refreshed weekly
    by pre-market.
14. **Drawdown circuit breaker** — no new entries while day P&L < -2% or
    rolling-week P&L < -4%. Computed from current equity vs the most
    recent EOD-snapshot equity (and Monday's snapshot for the week).
    Re-armed automatically the next day if day P&L recovers.
15. **Pre-market gap check** — at market-open, query each open position's
    last 2 daily bars. If `(today_open - yesterday_close) / yesterday_close
    <= -7%`, force-exit at market BEFORE placing new entries. Belt-and-
    suspenders for the rare case where the GTC stop-limit didn't fill on
    the gap.
16. **Take-profit ladder rung 1** — at unrealized_plpc >= +20%, sell half
    the position at market to lock the gain. The remaining half rides
    with the existing 5% trailing stop (already the ratchet rule at
    +20%). Idempotent: each entry's `take-profit-50` annotation in
    TRADE-LOG fires the ladder exactly once.
17. **Sector concentration cap** — max 3 open positions per GICS sector.
    Enforced in market-open and /trade by counting current positions
    against memory/SECTOR-MAP.md before each new entry.
18. **Price-monitor alert routing** — high-frequency price warnings
    (-5%/-6%/-7% bucket transitions) route to ntfy.sh via the `alert`
    discord.sh category. Keeps the Discord webhook rate limit (30 req/
    min) uncrowded. Requires NTFY_TOPIC to be set; otherwise falls back
    to Discord-or-DAILY-SUMMARY.md.
19. **Conviction-weighted position sizing** — replace the flat 20% cap
    with a score-weighted ladder (7→12%, 8→15%, 9→18%, 10→20%). The
    20% absolute ceiling still applies. Enforced in market-open and
    /trade BEFORE submit-order; the chosen target_pct is logged in
    TRADE-LOG so the dashboard can show actual vs target sizing.
20. **Re-entry guard** — if a ticker was stopped out (outcome `L` in
    SECTOR-LEDGER.md) within the last 3 trading days, no re-entry
    unless a fresh dated catalyst has been added to today's
    RESEARCH-LOG.md (distinct from the prior thesis). Blocks "noise
    bounces" — same idea, same setup, just lower entry.
21. **Commit serialization** — local cron-sync.sh uses flock on
    `.git/.commit-lock` so it skips a tick if another git operation
    holds the lock. Cloud routines retry pushes up to 3 times with
    `pull --rebase` between attempts before erroring out — handles
    concurrent main pushes from overlapping cloud routines without
    force-push.
22. **Log rotation** — local launchd `com.bullstocktrader.log-rotate`
    fires at 02:00 daily and trims `~/Library/Logs/bull-stock-trader-*.log`
    to the last 1000 lines. Prevents unbounded growth from cron-sync
    (every 15 min) and price-monitor (every 10 min).

## Entry Checklist
- Specific catalyst?
- Sector in momentum (and not on a 2-loss streak in SECTOR-LEDGER.md)?
- Stop level (fixed -7% at entry; promotes to 10% trailing once green)
- Target (min 2:1 R:R)

## Entry Scorer (rubric)

Every new BUY trade must score the four dimensions below from 1–10. The
total = round(mean(four scores)). Trades with total < 7 are REFUSED
(automated in /trade and /market-open). The full rubric block is logged
into TRADE-LOG.md alongside the trade so the weekly review can correlate
score → outcome.

| Dimension      | 1–3 (poor)                                           | 4–6 (medium)                                | 7–10 (strong)                                              |
|----------------|------------------------------------------------------|---------------------------------------------|------------------------------------------------------------|
| catalyst       | Vague, old, or vibes-based                           | Real but stale (>3 days)                    | Fresh (<48h), specific, public, named in RESEARCH-LOG       |
| momentum       | Sector flat or fading; ticker below 50DMA            | Sector mixed; ticker between 50DMA and 200DMA | Sector top-3 YTD; ticker breaking out above recent highs   |
| risk_reward    | <1.5:1                                               | 1.5–2.0:1                                   | >=2.0:1, with a clean technical level for the stop          |
| stop_distance  | Stop within 3% (auto-reject anyway)                  | -7% lands above a known support level       | -7% sits cleanly below a real support level                 |

JSON block format (write into TRADE-LOG.md verbatim):

    entry_scorer: {
      "catalyst": 8,
      "momentum": 7,
      "risk_reward": 9,
      "stop_distance": 7,
      "total": 8
    }

The weekly review audits the score → outcome correlation and recalibrates
the rubric monthly if scores 8-10 don't outperform scores of 7.
