# Daily Flow

Single-glance answer to "when does what fire, and which memory files does it
touch?" Renders inline on GitHub. Update when adding or removing a routine.

```mermaid
flowchart LR
    subgraph T["Daily timeline (America/Chicago, weekdays)"]
        direction TB
        AC["3:30 AM<br/><b>auth-canary</b><br/>API health pre-flight"]
        PM["6:00 AM<br/><b>pre-market</b><br/>research, ideas"]
        MO["8:30 AM<br/><b>market-open</b><br/>execute + place stops"]
        MD["12:00 PM<br/><b>midday</b><br/>cut losers, thesis check"]
        ST["1:30 PM<br/><b>stops</b><br/>reconcile trailing stops"]
        DS["3:00 PM<br/><b>daily-summary</b><br/>EOD + watchdog + cost tally"]
        WR["4:00 PM<br/><b>weekly-review</b><br/><i>Friday only</i>"]
        AC --> PM --> MO --> MD --> ST --> DS
        DS -. Friday .-> WR
    end

    subgraph M["memory/"]
        direction TB
        STRAT["TRADING-STRATEGY.md<br/><i>rulebook</i>"]
        TRADE["TRADE-LOG.md<br/><i>trades + EOD snapshots</i>"]
        RES["RESEARCH-LOG.md<br/><i>daily catalysts</i>"]
        BENCH["BENCHMARK.md<br/><i>YTD vs SPY</i>"]
        SECL["SECTOR-LEDGER.md<br/><i>W/L per sector</i>"]
        SECM["SECTOR-MAP.md<br/><i>GICS cache</i>"]
        WEEK["WEEKLY-REVIEW.md<br/><i>Friday recap</i>"]
    end

    PM -.->|R| STRAT
    PM -.->|R| TRADE
    PM -.->|R| SECL
    PM ==>|W| RES

    MO -.->|R| RES
    MO -.->|R| SECM
    MO ==>|W| TRADE
    MO ==>|W| SECL

    MD -.->|R| RES
    MD ==>|W| TRADE
    MD ==>|W| SECL

    ST ==>|W| TRADE

    DS -.->|R| TRADE
    DS ==>|W| TRADE
    DS ==>|W| BENCH

    WR -.->|R| BENCH
    WR -.->|R| SECL
    WR ==>|W| WEEK
```

**Solid (`==>`) = writes. Dashed (`-.->`) = reads.**

**Always-touched files**, omitted from the diagram to reduce noise:

- Every routine appends start + end heartbeats to `memory/RUN-LOG.jsonl`.
- Any routine that calls Perplexity appends to `memory/PERPLEXITY-LOG.md`.
- `daily-summary` reads both for the run-log watchdog (STEP 6) and the
  Perplexity cost tally (STEP 7).
- `auth-canary` writes to `TRADE-LOG.md` only on a failure.

**Discord notifications**, also off-diagram: each routine posts to a
category-specific channel (research / fill / midday / stops / eod / weekly /
error) per the routing in [scripts/discord.sh](scripts/discord.sh). See
[env.template](env.template) for `DISCORD_WEBHOOK_URL_*` overrides.

**Local-only commands** (no cron, no diagram): `/portfolio`, `/benchmark`,
`/trade SYM N buy|sell`. Defined in [.claude/commands/](.claude/commands/).
