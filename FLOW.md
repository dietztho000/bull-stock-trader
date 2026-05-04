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
        MM["10:00 AM<br/><b>mid-morning</b><br/>promote stops, escalate"]
        LM["11:00 AM<br/><b>late-morning</b><br/>thesis check"]
        MD["12:00 PM<br/><b>midday</b><br/>cut losers, full Perplexity"]
        ST["1:30 PM<br/><b>stops</b><br/>reconcile trailing stops"]
        AF["2:00 PM<br/><b>afternoon</b><br/>late-day thesis"]
        DS["3:00 PM<br/><b>daily-summary</b><br/>EOD + watchdog + cost tally"]
        WR["4:00 PM<br/><b>weekly-review</b><br/><i>Friday only</i>"]
        AC --> PM --> MO --> MM --> LM --> MD --> ST --> AF --> DS
        DS -. Friday .-> WR
    end

    subgraph M["memory/&lt;bot&gt;/&lt;strategy&gt;/"]
        direction TB
        STRAT["TRADING-STRATEGY.md<br/><i>rulebook</i>"]
        TRADE["TRADE-LOG.md<br/><i>trades + EOD snapshots</i>"]
        RES["RESEARCH-LOG.md<br/><i>daily catalysts</i>"]
        BENCH["BENCHMARK.md<br/><i>YTD vs SPY</i>"]
        SECL["SECTOR-LEDGER.md<br/><i>W/L per sector</i>"]
        EARN["EARNINGS-CALENDAR.md<br/><i>per-bot holdings</i>"]
        WEEK["WEEKLY-REVIEW.md<br/><i>Friday recap</i>"]
    end

    subgraph S["memory/shared/"]
        direction TB
        SECM["SECTOR-MAP.md<br/><i>GICS cache</i>"]
        ECON["ECONOMIC-CALENDAR.md<br/><i>FOMC/CPI/NFP</i>"]
        MARK["MARKET-EARNINGS.md<br/><i>cross-market earnings</i>"]
        PPLX["PERPLEXITY-LOG.md<br/><i>cost telemetry + cache</i>"]
    end

    PM -.->|R| STRAT
    PM -.->|R| TRADE
    PM -.->|R| SECL
    PM -.->|R| ECON
    PM ==>|W| RES
    PM ==>|W| EARN

    MO -.->|R| RES
    MO -.->|R| SECM
    MO ==>|W| TRADE
    MO ==>|W| SECL

    MM -.->|R| TRADE
    MM ==>|W| TRADE

    LM -.->|R| TRADE
    LM ==>|W| TRADE

    MD -.->|R| RES
    MD ==>|W| TRADE
    MD ==>|W| SECL

    ST ==>|W| TRADE

    AF -.->|R| TRADE
    AF ==>|W| TRADE

    DS -.->|R| TRADE
    DS ==>|W| TRADE
    DS ==>|W| BENCH

    WR -.->|R| BENCH
    WR -.->|R| SECL
    WR ==>|W| WEEK
```

**Solid (`==>`) = writes. Dashed (`-.->`) = reads.**

**Multi-bot fan-out**: each routine runs its STEP block once per enabled bot
in `memory/shared/dashboard-settings.json`. The cloud header source at
[routines/_cloud-header.md](routines/_cloud-header.md) wraps the body in
`while read BOT_ID ACCOUNT_ID STRATEGY BOT_ALLOCATION BOT_MODE; do …
done < <(bash scripts/bots.sh list)`. Per-bot memory paths use
`memory/$BOT_ID/$STRATEGY/`.

**Always-touched files**, omitted from the diagram to reduce noise:

- Every routine appends start + end heartbeats to
  `memory/<bot>/<strategy>/RUN-LOG.jsonl`. Auth-preflight failures emit a
  paired `start`/`end fail` under the discriminated routine name
  `<routine>:preflight:<bot_id>` so one bot's bad creds don't pollute the
  routine-level heartbeat (audit G4).
- Any routine that calls Perplexity appends to
  `memory/shared/PERPLEXITY-LOG.md`. Repeat queries within a CT day
  short-circuit via the cache at `memory/shared/.perplexity-cache.jsonl` so
  fan-out iterations after the first replay the cached answer (audit G2).
- `daily-summary` reads RUN-LOG (watchdog, STEP 6) and PERPLEXITY-LOG
  (cost tally, STEP 7).
- `auth-canary` writes to `TRADE-LOG.md` only on a failure.

**Discord notifications**, also off-diagram: each routine posts to a
category-specific channel (research / fill / midday / stops / eod / weekly /
error / auth-canary / alert) per the routing in
[scripts/discord.sh](scripts/discord.sh). See [env.template](env.template)
for `DISCORD_WEBHOOK_URL_*` overrides; per-bot `discordWebhookUrl` overrides
live in `memory/shared/dashboard-settings.json`.

**Local-only commands** (no cron, no diagram): `/portfolio`, `/benchmark`,
`/trade SYM N buy|sell`. Defined in [.claude/commands/](.claude/commands/).

**Local launchd helpers** (also no cron, no diagram): `cron-sync.sh` (every
15 min — backfills cloud-routine memory writes into local main),
`log-rotate.sh` (daily 02:00 — trims `~/Library/Logs/bull-stock-trader-*.log`
to 1000 lines), `price-monitor.sh` (every 10 min during market hours —
posts a `--type=alert` Discord/ntfy ping when a held position drops into a
new -5%/-6%/-7% bucket; per-bot fan-out and per-bot state files). Status
of all three is surfaced in the dashboard's `/bots` page.
