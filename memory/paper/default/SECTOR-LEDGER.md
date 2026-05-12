# Sector Ledger — paper/default

Tracks closed-trade outcomes per GICS sector to enforce rule #10 (exit a
sector after 2 consecutive failures) and rule #20 (re-entry guard: no
re-entry within 3 trading days of a stop-out unless fresh catalyst).

Outcomes: **W** = profitable exit | **L** = stop-out / loss | **B** = breakeven

| Date | Symbol | Sector | Entry | Exit | Realized P&L | Outcome |
|------|--------|--------|-------|------|--------------|---------|
| 2026-05-12 | AMKR | Information Technology | $68.14 | ~$71.06 | +4.29% (+$642) | W |
