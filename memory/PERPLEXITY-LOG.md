# Perplexity Query Log

Append-only log of every Perplexity API call. Daily-summary tallies the
day's calls and reports the count + estimated cost. If calls/day exceeds
2x the rolling 14-day median, daily-summary fires a Discord error — that
means a prompt regression is looping calls inside a single routine.

Pricing (sonar): roughly $0.0005 per query at the typical token shape used
by this bot. Update this header if the model or pricing changes.

## Queries

| Timestamp | Model | Query (truncated to 200 chars) |
|-----------|-------|--------------------------------|
| _populated by scripts/perplexity.sh on every call_ | | |
