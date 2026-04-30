---
description: Local pre-market research workflow. Reads memory, pulls state, runs Perplexity research, writes today's research log entry.
---

You are running the pre-market research workflow LOCALLY. Resolve today's date via:
DATE=$(date +%Y-%m-%d).

Credentials come from the local .env file (the wrapper scripts source it
automatically). No env-var check block. No commit/push step — the user
controls git locally.

<!-- STEPS-BEGIN -->
STEP 1 — Read memory for context:
- memory/TRADING-STRATEGY.md
- tail of memory/TRADE-LOG.md
- tail of memory/RESEARCH-LOG.md
- memory/SECTOR-LEDGER.md (recent sector outcomes — relevant when picking ideas)

STEP 2 — Pull live account state:
  bash scripts/alpaca.sh account
  bash scripts/alpaca.sh positions
  bash scripts/alpaca.sh orders

STEP 3 — Research market context via Perplexity. Run
bash scripts/perplexity.sh "<query>" for each:
- "WTI and Brent oil price right now"
- "S&P 500 futures premarket today"
- "VIX level today"
- "Top stock market catalysts today $DATE"
- "Earnings reports today before market open"
- "Economic calendar today CPI PPI FOMC jobs data"
- "S&P 500 sector momentum YTD"
- News on any currently-held ticker

If Perplexity exits 3, fall back to native WebSearch and note the
fallback in the log entry.

STEP 4 — Write a dated entry to memory/RESEARCH-LOG.md.
**Idempotency guard:** before appending, grep for `## $DATE — Pre-market Research`
in memory/RESEARCH-LOG.md. If a section for today already exists, REPLACE it
in place rather than appending a duplicate. A "Run again" of this routine
must NEVER produce two entries for the same date.

The dated entry should include:
- Account snapshot (equity, cash, buying power, daytrade count)
- Market context (oil, indices, VIX, today's releases)
- 2-3 actionable trade ideas WITH catalyst + entry/stop/target
- Sector check: cross-reference each idea against memory/SECTOR-LEDGER.md;
  flag any idea in a sector with a 2-loss streak (rule #10 will block it
  at /trade time anyway, but call it out here)
- Risk factors for the day
- Decision: trade or HOLD (default HOLD — patience > activity)

STEP 5 — ALWAYS post a research summary to the research channel.
Use this exact format (preserve emojis, blank line, and bullets):

  bash scripts/discord.sh --type=research "🔬 Pre-market — $DATE

📊 Market context:
• WTI: \$X / Brent: \$Y
• S&P futures: ±X.X% | VIX: XX.X
• Catalysts: <one-liner of today's biggest>

💡 Trade ideas (N):
1. SYM — entry \$X, stop \$Y, target \$Z (catalyst: <one-liner>)
2. SYM — entry \$X, stop \$Y, target \$Z (catalyst: <one-liner>)

⚠️ Risk factors: <one-liner>

Decision: HOLD"

If the decision is TRADE, write "Decision: TRADE — see market-open at 8:30 CT".
If a Perplexity query exits 3 (key missing), append a final line "Note:
Perplexity unavailable — used WebSearch fallback." before the Decision line.
Truncate any section to keep the total under ~1800 chars (Discord limit).
<!-- STEPS-END -->
