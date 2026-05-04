# Multi-Bot Contract

The shared agreement between the bash wrappers (`scripts/*.sh`), the cloud
routines (`routines/*.md`), and the Next.js dashboard (`dashboard/`) for how
**bots**, **accounts**, and **credentials** are named, resolved, and stored.

This is the source of truth — when in doubt, this document wins over inline
code comments.

---

## 1. Concepts

### Account
An **Alpaca credential set** — one API key + secret + endpoint. Each account
has a `mode` of `live` or `paper`. Multiple accounts are allowed (e.g. one
$10k live account, one $100k paper account, one $5k second-broker paper
account). Identified by a stable `accountId` slug.

### Bot
A **named trading agent** bound to one account, optionally with a soft
capital allocation (a $-amount carve-out within a shared account). One
account can host N bots — they share orders' visibility but each bot's
fills are attributed by the `client_order_id` prefix and its allocation
caps the sizing math. Identified by a stable `botId` slug.

### Strategy
A **rulebook variant** keyed by a slug (default: `default`). Per-bot
TRADING-STRATEGY.md lives at `memory/<botId>/<strategySlug>/TRADING-STRATEGY.md`.
A bot binds to ONE strategy; running the same strategy across multiple bots
is fine.

---

## 2. Slug rules

Slugs (for both `accountId` and `botId`) follow `slugSchema` in
[`dashboard/lib/settings.schema.ts:164`](../dashboard/lib/settings.schema.ts#L164):

- Lowercase letters, digits, and hyphens only: `^[a-z0-9][a-z0-9-]*$`
- Length 1–40
- Must start with a letter or digit (no leading hyphen)
- Examples: `live`, `paper`, `paper-100k`, `momentum-10k`, `legacy-paper`
- Counter-examples: `Paper-100K` (uppercase), `-paper` (leading hyphen),
  `paper_100k` (underscore), `paper.100k` (dot)

**Reserved**: the dashboard's seed migration writes `legacy-live` and
`legacy-paper` for environments that pre-date the registry; these slugs
should not be reused for fresh user-created bots.

---

## 3. Identity precedence (bash side)

When a wrapper script (`scripts/*.sh`) needs to know "which bot's memory
tree am I writing to?", it calls `_resolve_bot_id` from
[`scripts/_lib.sh`](../scripts/_lib.sh#L29):

```
1. $BOT_ID                # set by routine fan-out from `bash scripts/bots.sh list`
2. $BOT_MODE              # legacy single-bot fallback ("live" | "paper")
3. "live"                 # final fallback for env-less smoke tests
```

The result picks the directory under `memory/<bot>/`. **`BOT_MODE` is NEVER
used as a directory key directly** — that was the G1 bug fixed on
2026-05-03. `BOT_MODE` only routes credentials inside `alpaca.sh`.

`STRATEGY` defaults to `default` and is exported by routine fan-out from
the same `bots.sh list` row.

---

## 4. Memory layout

```
memory/
├── <botId>/<strategy>/      # per-bot, per-strategy state
│   ├── TRADING-STRATEGY.md  # rulebook
│   ├── TRADE-LOG.md         # trades + EOD snapshots
│   ├── RESEARCH-LOG.md      # daily catalysts
│   ├── BENCHMARK.md         # YTD vs SPY
│   ├── SECTOR-LEDGER.md     # W/L per sector
│   ├── EARNINGS-CALENDAR.md # per-bot holdings (rule #13)
│   ├── WEEKLY-REVIEW.md     # Friday recaps
│   ├── RUN-LOG.jsonl        # routine heartbeats
│   ├── BACKTEST-RESULTS.md  # dashboard "Run fresh"
│   └── BACKTEST-RESULTS.json
└── shared/                  # cross-bot caches (write idempotency required)
    ├── SECTOR-MAP.md        # GICS lookup per ticker
    ├── ECONOMIC-CALENDAR.md # FOMC / CPI / NFP
    ├── MARKET-EARNINGS.md   # cross-market earnings
    ├── PERPLEXITY-LOG.md    # cost telemetry
    ├── .perplexity-cache.jsonl  # gitignored fan-out idempotency cache
    ├── DASHBOARD-AUDIT.jsonl    # dashboard write audit trail
    └── dashboard-settings.json  # GITIGNORED — registry, vault, settings
```

**Memory-file scope** (per-bot vs shared) is registered in
[`dashboard/lib/memoryPath.ts`](../dashboard/lib/memoryPath.ts) — adding a
new memory file requires an entry there.

### `memoryAlias`

A bot record in `dashboard-settings.json` may set `memoryAlias`: when
present, the bot's memory tree lives at `memory/<memoryAlias>/<strategy>/`
instead of `memory/<botId>/<strategy>/`. Used by the seed migration so a
bot named `legacy-live` continues to read the historical `memory/live/`
tree without a one-time copy. The bash side picks the directory via
`_resolve_bot_id` (which returns the bot id, not the alias) — so cloud
routines that adopt the registry must use the alias-aware bot id from
`bots.sh list`.

---

## 5. Credential resolution (bash side)

`scripts/alpaca.sh` resolves API key + secret + endpoint via this
precedence:

```
1. --account-id=<slug>  → namespaced env vars
   ALPACA_<NS>_API_KEY  / ALPACA_<NS>_SECRET_KEY  / ALPACA_<NS>_ENDPOINT
   where <NS> = uppercase(slug) with hyphens → underscores.
   Example: --account-id=paper-100k → ALPACA_PAPER_100K_API_KEY etc.

2. $BOT_MODE = "paper"  → ALPACA_PAPER_API_KEY  / ALPACA_PAPER_SECRET_KEY
                          ALPACA_PAPER_ENDPOINT (default paper-api.alpaca.markets)

3. $BOT_MODE = "live"   → ALPACA_API_KEY  / ALPACA_SECRET_KEY
                          ALPACA_ENDPOINT (default api.alpaca.markets)
```

The dashboard's `runAlpaca({ accountId })` wrapper in
[`dashboard/lib/alpaca.ts`](../dashboard/lib/alpaca.ts) agrees with this
contract: it decrypts the AES-256-GCM-vaulted credentials for that
account from `dashboard-settings.json` and exports them into the spawned
bash process under both the namespaced names AND the legacy slot for
back-compat with wrappers that haven't been updated.

### `bots.sh env-namespace`

For scripting, the namespacing rule is exposed via:

```bash
bash scripts/bots.sh env-namespace paper-100k
# → PAPER_100K
```

Use this to derive env var names dynamically rather than reimplementing
the slug-uppercase rule in each script.

---

## 6. Order tagging (`client_order_id` convention)

Every order submitted via `scripts/alpaca.sh submit-order` is auto-tagged
with `--bot-id=<botId>` so fills can be attributed without reading the
audit log:

```
client_order_id = "<botId>-<ymd>-<nanoid>"
```

The dashboard's [`botIdFromClientOrderId`](../dashboard/lib/bots/perBotPositions.ts)
parses this to attribute closed-order P&L per bot. **Bot ids must be
unambiguous as prefixes**: a bot named `momentum` and one named
`momentum-10k` would collide on the simple-prefix match — the parser
sorts longest-first to disambiguate.

---

## 7. Routine fan-out

Cloud routines wrap their STEP block in this loop (sourced from
[`scripts/_routine-header.sh`](../scripts/_routine-header.sh) — see
[`routines/_cloud-header.md`](../routines/_cloud-header.md)):

```bash
source scripts/_routine-header.sh
_routine_assert_bots_present <routine>
_routine_emit_start          <routine>

while IFS=$'\t' read -r BOT_ID ACCOUNT_ID STRATEGY BOT_ALLOCATION BOT_MODE; do
  export BOT_ID ACCOUNT_ID STRATEGY BOT_ALLOCATION BOT_MODE
  _routine_preflight_or_skip <routine> || continue
  # STEP 1..N
done < <(bash scripts/bots.sh list)

_routine_emit_end <routine> ok
```

`bash scripts/bots.sh list` emits TAB-separated rows from
`memory/shared/dashboard-settings.json`:

```
bot_id  account_id  strategy  allocation  mode
```

Each STEP block must include `--account-id="$ACCOUNT_ID" --bot-id="$BOT_ID"`
on every `alpaca.sh` call so the resolved credentials and the
`client_order_id` prefix match the active bot.

---

## 8. Idempotency

Per [`CLAUDE.md`](../CLAUDE.md), every routine memory write is
idempotent — a retried run for the same period must NEVER produce a
duplicate entry. Implementations:

- **Markdown sections**: grep for the date anchor before appending; if it
  exists, REPLACE in place.
- **Markdown table rows**: same — grep `| YYYY-MM-DD |` first.
- **PERPLEXITY-LOG.md**: per-day `(model, query)` cache at
  `memory/shared/.perplexity-cache.jsonl`. Cache hits log a row tagged
  `(cached)` in the model column instead of firing the API.
- **RUN-LOG.jsonl**: append-only by design; two runs producing two
  rows is intentional (it tells us the routine fired twice).
- **Cross-bot files** (`memory/shared/`): single global write per fan-out
  cycle. The fan-out preamble stops one routine from re-writing
  ECONOMIC-CALENDAR.md once per bot.

---

## 9. Things NOT covered by this contract

- Discord webhook routing (`--type=<category>` lives in `discord.sh`)
- ntfy.sh push delivery (gated by `NTFY_TOPIC`)
- Cloud-routine commit serialization (mkdir-lock in `cron-sync.sh`,
  rule #21)
- Log rotation (rule #22, see `scripts/log-rotate.sh`)

---

## 10. Quick reference: where to change what

| If you want to…                                  | Edit                                                                      |
|--------------------------------------------------|---------------------------------------------------------------------------|
| Add a new memory file                            | Register scope in [`dashboard/lib/memoryPath.ts`](../dashboard/lib/memoryPath.ts) |
| Change BOT_ID / BOT_MODE precedence              | [`scripts/_lib.sh`](../scripts/_lib.sh) `_resolve_bot_id`                 |
| Add a new namespaced env var                     | Update [`scripts/alpaca.sh`](../scripts/alpaca.sh) cred resolver          |
| Add a new fan-out helper                         | [`scripts/_routine-header.sh`](../scripts/_routine-header.sh)             |
| Change `bots.sh list` row format                 | [`scripts/bots.sh`](../scripts/bots.sh) — keep cloud-header sync          |
| Add a new routine                                | `.claude/commands/<name>.md` + `routines/_cloud-footer-<name>.md` + add to `ROUTINES=()` in `scripts/build-routines.sh`, then run it |
| Adjust the slug regex                            | [`dashboard/lib/settings.schema.ts`](../dashboard/lib/settings.schema.ts) `slugSchema` |
