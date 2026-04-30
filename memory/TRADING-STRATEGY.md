# Trading Strategy

## Mission
Beat the S&P 500 over the challenge window. Stocks only — no options, ever.

## Capital & Constraints
- Starting capital: ~$10,000
- Platform: Alpaca
- Instruments: Stocks ONLY
- PDT limit: 3 day trades per 5 rolling days (account < $25k)

## Core Rules
1. NO OPTIONS — ever
2. 75-85% deployed
3. 5-6 positions at a time, max 20% each
4. 10% trailing stop on every position as a real GTC order
5. Cut losers at -7% manually
6. Tighten trail: 7% at +15%, 5% at +20%
7. Never within 3% of current price; never move a stop down
8. Max 3 new trades per week
9. Follow sector momentum
10. Exit a sector after 2 consecutive failed trades (enforced via SECTOR-LEDGER.md)
11. Patience > activity
12. Entry Scorer >= 7/10 required for every new buy (rubric below)

## Entry Checklist
- Specific catalyst?
- Sector in momentum (and not on a 2-loss streak in SECTOR-LEDGER.md)?
- Stop level (7-10% below entry)
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
| stop_distance  | Stop within 3% (auto-reject anyway)                  | Stop 4–6% below entry                       | Stop sits below a real support level, 7–10% below           |

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
