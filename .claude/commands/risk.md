---
description: Read-only portfolio risk dashboard. Beta vs SPY, correlation matrix, VIX-aware deployment recommendation.
---

Print a portfolio risk snapshot. No state changes, no orders, no file writes.

The static 75–85% deployment band shouldn't apply equally at VIX 13 vs VIX 28.
This command computes a regime-aware recommendation and reports it as
GUIDANCE only — never auto-trim.

1. Pull state:
     bash scripts/alpaca.sh account
     bash scripts/alpaca.sh positions
     bash scripts/alpaca.sh bars SPY 1Day "" "" 90    # 90 daily bars for beta
2. Pull 90 daily bars for each open position:
     bash scripts/alpaca.sh bars SYM 1Day "" "" 90
3. Pull VIX (best-effort — Alpaca doesn't carry ^VIX directly):
     bash scripts/perplexity.sh "current VIX index level today"
   Parse the numeric value; on failure, pass null to the helper.
4. Build a JSON document with this shape (see scripts/risk.py docstring):
     {
       "spy_closes":  [...90 bars...],
       "positions":   [{symbol, qty, market_value, closes:[...]}],
       "equity":      <float>,
       "vix":         <float | null>
     }
   Pipe it into the risk helper:
     echo "$JSON" | python3 scripts/risk.py
5. Print a clean summary:

Risk — <today's date>
Equity: $X | Deployed: X.X% (of $X equity)
Portfolio beta: X.XX | VIX: XX.X
Per-position beta:
  SYM 1.32 (weight 18.4%)
  ...
Correlation hot-spots (|r| >= 0.7):
  SYM <-> SYM r=0.81
Deployment recommendation: <one line from helper>

6. If portfolio_beta > 1.6 OR avg correlation > 0.7, send a Discord
   `--type=error` warning. Otherwise silent.

This is GUIDANCE only. Never auto-trim positions from this command.
