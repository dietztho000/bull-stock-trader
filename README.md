# BULL Stock Trader — Autonomous Trading Bot

A cloud-scheduled, Git-as-memory trading agent built on Claude Code. Seven cron
routines fire each weekday: pre-dawn auth-canary, pre-market research,
market-open execution, midday scan, mid-afternoon stop reconciliation, daily
summary, and Friday weekly review. **Claude is the bot** — there is no
separate Python process. Every run is a fresh container that clones `main`,
reads memory, calls the live APIs, writes new memory, and pushes.

## Strategy at a glance
Swing trading stocks only — no options, ever. Max 5–6 positions, max 20% per
position, max 3 new trades per week, 75–85% deployed. Every position gets a
real 10% trailing stop GTC order on Alpaca. Cut losers at -7%; tighten the
trail to 7% at +15% and 5% at +20%. Exit a sector after two consecutive
failed trades. Patience > activity.

Full rules: [memory/TRADING-STRATEGY.md](memory/TRADING-STRATEGY.md).

## Repo layout

```
.
├── CLAUDE.md              # Auto-loaded rulebook for every session
├── env.template           # Copy to .env locally; cloud uses routine env vars
├── .gitignore             # Excludes .env
├── .claude/commands/      # Local ad-hoc slash commands (single source of truth for steps)
├── routines/              # Cloud routine prompts — auto-generated from commands
├── scripts/               # API wrappers (alpaca, discord, perplexity) + helpers
└── memory/                # Persistent state — every commit is the audit trail
```

## Local quickstart

```bash
cp env.template .env
# fill in ALPACA_*, PERPLEXITY_*, DISCORD_WEBHOOK_URL values
chmod +x scripts/*.sh
```

Then in Claude Code:

```
/portfolio       # read-only snapshot — smoke test
/benchmark       # YTD-vs-SPY snapshot — read-only
/auth-canary     # 5-min preflight ping to all 4 APIs (cron: weekdays 3:30am CT)
/pre-market      # write today's research
/market-open     # validate + execute
/midday          # cut losers, tighten winners
/stops           # reconcile every position has the right trailing stop
/daily-summary   # EOD recap + Discord message + run-log watchdog
/weekly-review   # Friday only
/trade SYM N buy # ad-hoc trade with full rule + entry-scorer validation
```

## Cloud setup

See [routines/README.md](routines/README.md) for the six-step routine setup,
the cron schedule, and the env vars each routine needs. The two things that
break first-time setups every time:

1. The Claude GitHub App must be installed on this repo.
2. **"Allow unrestricted branch pushes"** must be toggled on in each routine's
   environment. Without it, `git push origin main` silently fails.

## Memory model

Markdown files in `memory/` are the bot's only state between runs. Every
write is an append-only dated section, so merge conflicts are effectively
impossible across the hours-apart routine schedule.

| File                  | Cadence                                  |
|-----------------------|------------------------------------------|
| TRADING-STRATEGY.md   | Friday only, when a rule changes         |
| TRADE-LOG.md          | Every trade, every EOD                   |
| RESEARCH-LOG.md       | Every pre-market                         |
| BENCHMARK.md          | Every EOD (one row/day vs SPY)           |
| SECTOR-LEDGER.md      | On every closed trade (W/L)              |
| SECTOR-MAP.md         | Cached GICS lookup per ticker            |
| WEEKLY-REVIEW.md      | Fridays                                  |
| RUN-LOG.jsonl         | Every routine start + end (heartbeat)    |
| PERPLEXITY-LOG.md     | Every Perplexity query (cost telemetry)  |

## Editing workflow steps

The STEP content for each cloud routine lives in `.claude/commands/<name>.md`
between `<!-- STEPS-BEGIN -->` and `<!-- STEPS-END -->` markers — the single
source of truth. To regenerate the cloud routine prompts after editing a
command:

```bash
bash scripts/build-routines.sh
git add .claude/commands/<name>.md routines/<name>.md
```

## Notification philosophy

Most bots are chatty. This one isn't. Pre-market silent unless urgent.
Market-open only if a trade fires. Midday only if action was taken. The
daily summary and weekly review always send. The cost of a missed alert is
low (you can `/portfolio` anytime); the cost of a chatty bot is that you
stop reading.

For boring-tech redundancy, set `NTFY_TOPIC` to push notifications to your
phone via [ntfy.sh](https://ntfy.sh) alongside Discord — no extra credentials.
