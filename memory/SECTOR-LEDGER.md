# Sector Ledger — Rule #10 enforcement

Every closed trade appends a row here. /trade and /market-open consult this
file BEFORE opening a new position; if the target sector has 2+ consecutive
losses in the last 30 days, the trade is REFUSED.

A "sector reset" row is appended automatically when a winning trade clears
a streak. The ledger is append-only — never delete rows; the audit trail is
the whole point.

## Closed trades

| Date | Symbol | Sector | Side | Entry | Exit | P&L $ | P&L % | Outcome | Notes |
|------|--------|--------|------|-------|------|-------|-------|---------|-------|
| _first row appended on first close_ | | | | | | | | | |

## Streak tracker

A live snapshot maintained by the routines. Recalculate from the table
above whenever a row is added — don't trust this without verification.

| Sector | Last 2 outcomes | 30-day streak | Status |
|--------|-----------------|---------------|--------|
| _populated as trades close_ | | | OPEN |

## Outcome legend

- W = win (positive realized P&L)
- L = loss (negative realized P&L; includes -7% rule cuts and thesis-broken cuts)
- B = breakeven (between -1% and +1%) — neutral, doesn't count toward streak
