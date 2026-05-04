# Bull Stock Trader Dashboard — Codebase Audit

_Generated 2026-05-02 by Codebase Auditor agent against `/Users/dietz/Desktop/Apps/bull-stock-trader/dashboard/`_

> All file paths in this report are **dashboard-relative** (use them from `dashboard/` as cwd) so the `[label](path#L42)` links open the cited line directly. Cross-tree references (scripts, memory, .claude) are shown as absolute paths from the repo root.

---

## 1. Executive Summary

The dashboard is in the middle of a high-impact remediation: a clean multi-bot/multi-account model lives in [`lib/settings.schema.ts`](lib/settings.schema.ts), [`lib/accountVault.ts`](lib/accountVault.ts), [`lib/resolveAccount.ts`](lib/resolveAccount.ts), [`lib/bots/`](lib/bots/perBotPositions.ts), and a working `/bots` UI ([`components/bots/BotsManager.tsx`](components/bots/BotsManager.tsx)) — but **the migration is only ~50% wired through the rest of the app**. The Overview, Trades, Order Entry, Position Management, KPI tiles, mascot, AlertWatcher, MarketClock, AccountIdentityTile, backtest API, and the file watcher all still hard-assume a `live`/`paper` binary, which means a user who creates `momentum-10k → paper-100k` from `/bots` will see the right account in the badge dropdown but get the **wrong** account's equity, positions, orders, and strategy state on every page — and any order they submit from the dashboard will land on the legacy `.env` paper account, **not** their bot's bound account. There is also one **Critical** safety regression (`alpacaApiUrl()` in [`lib/alpacaMode.ts`](lib/alpacaMode.ts) silently sends an unscoped query when `mode` is undefined, which `runAlpaca` resolves to `BOT_MODE=live` → live-account writes from the paper UI). Everything else is polish: webhook category drift, no vault-key warning banner, no per-bot routine status, hardcoded `bot=mode` in the backtest runner, missing CT helper guard for one `getDay()` in the brief route, and a settings-page copy bug pointing to the old `memory/dashboard-settings.json` path.

---

## 2. Top 5 Critical Gaps

### C1 — Live tiles & write paths ignore the bot/account binding

**Why it matters.** This breaks the entire value proposition of the new multi-bot system. A user who carves a $10k slice off `paper-100k` for `momentum-10k` will look at the Overview page and see numbers for the legacy `ALPACA_PAPER_*` env account — possibly a different paper account entirely. Worse, [`OrderEntryTile`](components/live/OrderEntryTile.tsx#L141) and [`PositionManagementTile`](components/live/PositionManagementTile.tsx#L77) submit orders with only `mode` in the body, so `/api/alpaca/order` resolves identity via the `mode` branch ([`app/api/alpaca/order/route.ts`](app/api/alpaca/order/route.ts#L104-L113)) and the order hits the env account — silently bypassing the `momentum-10k-` `client_order_id` prefix that virtual-equity attribution depends on.

**Affected reads (every one passes raw `mode`):**
- [`PnlHero.tsx#L36`](components/live/PnlHero.tsx#L36), [`PnlHero.tsx#L41`](components/live/PnlHero.tsx#L41)
- [`useAccountSummary.ts#L44`](components/live/useAccountSummary.ts#L44) (powers all KPI tiles + mascot)
- [`LivePositions.tsx#L122`](components/live/LivePositions.tsx#L122)
- [`LiveOrders.tsx#L44`](components/live/LiveOrders.tsx#L44)
- [`PositionManagementTile.tsx#L36-L39`](components/live/PositionManagementTile.tsx#L36)
- [`useBullMood.ts#L139`](components/mascot/useBullMood.ts#L139)
- [`useMarketIsOpen.ts#L21`](lib/useMarketIsOpen.ts#L21) (and `MarketClock` hardcodes `/api/alpaca/clock` with no account at all — [`MarketClock.tsx#L15`](components/live/MarketClock.tsx#L15))

**Affected writes:**
- [`OrderEntryTile.submit`](components/live/OrderEntryTile.tsx#L130-L150) — body is `{symbol, qty, side, …, mode}`. No `accountId`/`botId`.
- [`PositionManagementTile.close`](components/live/PositionManagementTile.tsx#L71-L82) and `.tighten` — same pattern.

**Fix.** Plumb `accountId` + `botId` through `useTradingAccount()` (already exposed there — see [`tradingAccountContext.tsx#L82-L88`](lib/tradingAccountContext.tsx#L82)) into every `alpacaApiUrl()` call site, and into every `fetch()` body for `/api/alpaca/order`, `/api/alpaca/close`. The `alpacaApiUrl({accountId})` overload already exists ([`alpacaMode.ts#L17-L28`](lib/alpacaMode.ts#L17)) — just thread it. Estimated effort: **Medium** (mechanical but ~12 files).

**Severity:** **Critical**.

---

### C2 — `alpacaApiUrl(cmd, undefined)` silently downgrades to legacy `BOT_MODE`

**Why it matters.** Implements the same trap as C1 but at the framework layer. If a client component reads from `useTradingAccountOptional()` while it's still loading, `effectiveMode` is `undefined` and the SWR key becomes `/api/alpaca/<cmd>` with no qs ([`alpacaMode.ts#L26`](lib/alpacaMode.ts#L26)). The route then falls through to `runAlpaca({})` with no `mode` and no `accountId`, which `buildEnvForOpts` resolves with `process.env`/`.env` — i.e. **whatever `BOT_MODE` is set to**. On a host where `BOT_MODE=live`, a paper-bot tile that briefly hydrates with `undefined` will momentarily call the **live** account. This is also why `MarketClock.tsx` quietly works today — it always queries the live env account.

**Fix.** In `alpacaApiUrl()`, treat `mode === undefined` and `accountId === undefined` as an error (return a sentinel URL like `/api/alpaca/<cmd>?account=__unresolved__` and have the route 400 it), or short-circuit the SWR call (return `null` so SWR skips the fetch). Also: in `runAlpaca`, refuse to run when neither `mode` nor `accountId` is set unless an explicit `allowEnvFallback: true` is passed.

**Severity:** **Critical**.

---

### C3 — Backtest API hardcodes `bot = mode`, breaking per-bot snapshots

**Why it matters.** [`app/api/backtest/run/route.ts#L17-L18`](app/api/backtest/run/route.ts#L17) does `const ctx = { bot: mode };` then writes the snapshot under `memory/<mode>/default/BACKTEST-RESULTS.json` regardless of which bot triggered the run. Two paper bots with different strategy slugs (or different histories on different `accountId`s) will overwrite each other's snapshot. The Analytics → Backtest tab also uses `mode="paper"` on the trigger button ([`app/analytics/page.tsx#L465`](app/analytics/page.tsx#L465)) — divorced from the active bot context.

**Fix.** Change `/api/backtest/run` to accept `?account=<botId>`, resolve via `resolveBotCtx`, and pass `{ bot: botId, strategy }` to `runBacktest` (which already lives behind a `MemoryCtx`). The button needs the same wiring.

**Severity:** **Critical** (data loss risk on multi-bot installs).

---

### C4 — Discord webhook category schema is missing 3 of the 9 actual categories

**Why it matters.** [`scripts/discord.sh`](../scripts/discord.sh) accepts categories `research|fill|midday|stops|eod|weekly|error|auth-canary|alert`, and routines pass `--type=stops` ([`/Users/dietz/Desktop/Apps/bull-stock-trader/.claude/commands/stops.md`]) and `--type=auth-canary`. The dashboard's filter schema only knows six: [`settings.schema.ts#L60-L69`](lib/settings.schema.ts#L60), and the `WebhookCategory` type-guard on [`L465`](lib/settings.schema.ts#L465) explicitly rejects the missing three. Net effect: users **cannot** disable `stops` notifications via the UI (every fixed-stop GTC fire on rule #6/#13/#15 spams the channel), and the dashboard's brief-send code can't even refer to the `stops` category by its narrow type.

**Fix.** Add `stops`, `auth-canary`, `alert` to `webhookCategoryFiltersSchema`, the patch schema, and `isWebhookCategory()`. Bonus: `alert` should default to `false` for Discord and `true` for ntfy, matching the rule-#18 routing in `discord.sh`.

**Severity:** **High** (verging on Critical for noisy users).

---

### C5 — `useAlertWatcher` and `useStrategyState` don't pass the active bot

**Why it matters.** [`useStrategyState.ts#L41-L47`](lib/useStrategyState.ts#L41) calls `/api/overview/strategy-state` with no `?account=`, so the route falls through to `resolveBotCtx({})` → `BOT_MODE` env — **always the same bot regardless of the dropdown**. The mascot, the AlertWatcher, and the OrderEntryTile rule-checker all consume this; switching from `paper` → `momentum-10k` in the AccountSelector will leave the mascot's risk-flavor strings, the toast watcher, and the entry-rule blocker all referencing a stale bot's sector ledger / cooldown / earnings-T2 state. This is the silent way "I switched bots and the mascot is still telling me about my live cooldowns" happens.

**Fix.** Read the URL `?account=` (or pull from `useTradingAccount()`) and append it to the SWR key. Same fix for `/api/ai/chat` (already takes `?account=`, but the [`ChatPanel.tsx#L41`](components/ai/ChatPanel.tsx#L41) doesn't pass it — chats always answer about the env-default bot).

**Severity:** **Critical** (rule-blocker on `OrderEntryTile` could mistakenly clear an entry that should be cooldown-blocked on the active bot).

---

## 3. Missed Feature Opportunities

### F1 — Per-bot Overview composition (so multi-bot users actually use the system)
Today there's one `/?account=<bot>` view — to compare two bots you toggle the dropdown back and forth and watch the page reload. A `/bots/compare` view that pulls equity/positions for every enabled bot in parallel via the existing `/api/bots/[id]/equity` would be a **5x** value-add. The `botEquity()` function already exists ([`lib/bots/virtualEquity.ts#L24`](lib/bots/virtualEquity.ts#L24)) — wire the UI. **Effort: Medium.**

### F2 — Cross-bot leaderboard on `/bots` page
The `/bots` page is a list of cards. Add a sortable table: bot name · mode · virtual equity · day P&L · phase alpha vs SPY · trades-this-week · drawdown. Lets the user kill a bot that's underperforming for 30 days or promote a paper bot whose backtest snapshot beats live. The data is already in `botEquity()` + `loadBenchmark()` per bot. **Effort: Small-Medium.**

### F3 — Allocation slider + "what-if" preview when creating a bot
When the user sets `allocation = $10k` on a $100k paper account, today they just see "Remaining: $90k". Add a horizontal stacked bar visualizing the account's slices (existing bots + this new one + free), in the spirit of `account-identity` tile. Helps prevent accidental over-allocation. **Effort: Small.**

### F4 — Promote-to-live workflow (paper-to-live, in one click)
Hard rule from the parent CLAUDE.md: "Promotion = copy `memory/paper/<strategy>/TRADING-STRATEGY.md` over the live equivalent and commit." Today this is a manual `cp` + `git commit`. Add a **Promote** button on the `/bots` card that:
1. Diffs the paper bot's `TRADING-STRATEGY.md` vs the target live bot's,
2. Shows it in a confirm modal,
3. Writes the file (idempotently),
4. Tags the live bot's TRADE-LOG with a `## Strategy update — promoted from <paper-bot>` anchor.

This is the single highest-leverage missing feature for a paper-bot-first workflow. **Effort: Medium.**

### F5 — Vault key health banner
[`accountVault.ts#L40-L58`](lib/accountVault.ts#L40) already exposes `isVaultUsingFallback()`. Surface it: a sticky red strip at the top of `/settings` and `/bots` saying "BULL_VAULT_KEY not set — credentials will be re-encryptable but not portable across machines. [Generate one]". The `[Generate one]` link runs `generateVaultKey()` server-side and shows the user the base64 string to paste into `.env`. **Effort: Small.**

### F6 — Per-bot routine status on the Journal → Routines tab
[`app/journal/page.tsx#L289-L353`](app/journal/page.tsx#L289) already shows per-routine fire status, but it's per-bot only via `?account=` — there's no overview. With registry-driven fan-out ([`/Users/dietz/Desktop/Apps/bull-stock-trader/.claude/commands/pre-market.md`]) every routine runs N times now. A grid where rows are routines and columns are bots, cells are colored by latest status, would let the user spot "midday failed for `momentum-10k` 3 days running" instantly. **Effort: Medium.**

### F7 — "Sandbox sentinel" — auto-disable a bot after N straight stop-outs
A safety feature for the multi-bot world: surface a toggle in the bot card "auto-disable after N consecutive losses" that flips `bot.enabled = false` via the existing PATCH route ([`app/api/bots/[id]/route.ts#L16-L34`](app/api/bots/[id]/route.ts#L16)). Pairs nicely with the existing alert rules. **Effort: Small.**

### F8 — Backtest a paper bot's strategy against a live bot's history
Today backtest is "replay this bot's own trades against new exit rules". Add "replay live bot's trades using paper bot's TRADING-STRATEGY" — directly answers "would my paper experiment have beaten my live bot YTD?" The runner just needs a `{strategySource: BotId, tradeSource: BotId}` ctx. **Effort: Medium-Large.**

### F9 — Strategy diff view
With multiple bots running variants, surface a `/strategy?compare=<other-bot>` view that side-by-sides their TRADING-STRATEGY.md with rule-level diffs highlighted. **Effort: Small** (use a JS markdown-aware differ).

### F10 — Discord per-bot webhook routing
The schema has one `webhookUrl` + one `webhookUrlResearch` per dashboard. With N bots, users will want `momentum-10k` → its own channel. Extend the per-bot record with optional `discordWebhookUrl` overrides; `sendDiscord()` resolves the bot context first. **Effort: Small** (additive, fully back-compat).

---

## 4. Architectural & Code Quality Recommendations

### A1 — Eliminate `AlpacaMode` from anything below the badge layer
**Why it matters.** `AlpacaMode = "paper" | "live"` is a **display attribute** of the bot's bound account. Treating it as identity is the root cause of C1, C2, C5. It should appear ONLY in (a) the live-confirm dialog, (b) the mode-tinted badge color picker, (c) the bash wrapper's mode flag. Everywhere else, the unit of identity is `botId` (or `accountId` for orders the wrapper script translates).

**Approach.** Add a deprecation lint via a TypeScript `eslint-plugin-unicorn`-style rule, or grep-add `// TODO(multi-bot): replace AlpacaMode with BotId` comments at every `mode: AlpacaMode` prop. Then mechanically refactor in waves: live tiles first, then mascot, then write paths. Eventually `AlpacaMode` survives only in `lib/alpacaMode.ts` and `ModeBadge`. **Effort: Large** but parallelizable (one PR per file family).

### A2 — Collapse `mode.ts` legacy probes behind a single `accountInfo({botId})` API
[`lib/mode.ts`](lib/mode.ts) has three probe functions: `detectMode()`, `detectAccountInfo(target: AlpacaMode)`, and `detectAccountInfoById(accountId)`. `AccountIdentityTile` calls the second by mode — so on a multi-account install it shows the wrong account number. Unify into one function that takes a `botId` and returns the resolved account info, deprecate the legacy two. The `BOT_MODE` fallback can live inside, gated by "no bot in registry".

### A3 — Server-side strategy-state cache, keyed by `(botId, lastMemorySync)`
`/api/overview/strategy-state` runs `loadStrategyState` (which in turn calls Alpaca + 3 file reads) on every poll. With `useStrategyState` polling at 60s and the alert watcher + mascot + order-entry tile all consuming it, that's 1 request/min per consumer × N tabs. Add a `Map<botId, { state, ttl }>` with a 30s TTL and SSE-flush on memory change. Saves Alpaca calls and CPU. **Effort: Small.**

### A4 — Standardize the `?account=` query param name
The URL param is `account`, the URL var name is `botId`, the bot record id is `bot.id`, and the alpaca-API param is `accountId`. Three different "account" meanings on one screen. Rename the URL param to `bot` (with a one-release back-compat shim that copies `?account=` into `?bot=` and warns), and update bookmarks doc. **Effort: Small.**

### A5 — Move write-path identity resolution into a shared helper
[`/api/alpaca/order/route.ts`](app/api/alpaca/order/route.ts#L74-L113) and [`/api/alpaca/close/route.ts`](app/api/alpaca/close/route.ts#L41-L82) reimplement the same `accountId/mode/botId` resolution logic with subtle differences (close uses `account` not `accounts`, has its own copy of the bot-vs-account FK check). Extract `resolveOrderIdentity(body)` into `lib/resolveAccount.ts` and call it from both routes — guarantees they stay in lockstep when (e.g.) a `--via-bot-routine=true` flag is added. **Effort: Small.**

### A6 — Let `lib/watch.ts` know about new bots
[`lib/watch.ts#L36-L48`](lib/watch.ts#L36) hardcodes `live`/`paper` segments — a write to `memory/momentum-10k/default/TRADE-LOG.md` is classified as `bot: null` (legacy flat layout warning) instead of routed properly. Result: SSE consumers may not know which bot updated when a new bot writes. Replace the segment check with "is this a known botId per the current registry?" by reading `listBots()` once at watcher init and re-reading on settings file change.

### A7 — `seedFromEnv` writes its own `id` collision risk
[`lib/migrations/seedFromEnv.ts#L34-L70`](lib/migrations/seedFromEnv.ts#L34) creates bots with **fixed ids** `live` and `paper`, and accounts `live-main` / `paper-main`. If the user later makes a bot called `paper` from the UI, they hit a duplicate-id error. Either (a) namespace the seed under `legacy-live` / `legacy-paper`, or (b) reserve those slugs in the schema's slug regex with a clearer error message.

### A8 — `assertReferentialIntegrity` doesn't enforce per-account allocation total
[`settings.ts#L159-L173`](lib/settings.ts#L159) checks dup ids and missing FKs but does not enforce `sum(bots.allocation) <= account.totalCapital`. The UI shows an over-allocation warning but the server happily persists it. Add a soft warning header in the response (`X-Allocation-Warning: account paper-100k over-allocated by $5,000`) so the UI can surface it consistently.

### A9 — `runAlpaca` injects creds into BOTH live + paper env slots
[`lib/alpaca.ts#L107-L120`](lib/alpaca.ts#L107) writes the resolved cred set into `ALPACA_API_KEY` AND `ALPACA_PAPER_API_KEY` AND sets `BOT_MODE=creds.mode`. That's defensive (works regardless of `--mode` flag) but if the wrapper script later spawns a sub-process that introspects `BOT_MODE` for routing decisions (the routines do!), the result is correct only because the modes match. If `BOT_MODE=live` and the user runs a paper-bot order, the spawned `bash` sees `BOT_MODE=paper` (good — overridden) but other env-derived defaults inside `_lib.sh` may not. Audit the bash wrapper's other `BOT_MODE` reads to make sure none are read **before** the override gets applied, and document the invariant.

### A10 — Remove the `EARNINGS-CALENDAR` per-bot scoping (or share between bots on the same account)
[`memoryPath.ts#L35`](lib/memoryPath.ts#L35) marks `EARNINGS-CALENDAR.md` as per-bot. Two bots on the same `paper-100k` account holding `AAPL` will each query Perplexity for AAPL's earnings — wasteful and inconsistent. Move it to `shared` (the per-bot scoping was for the legacy "earnings of bot's holdings" semantics that's now redundant with `loadMarketEarnings`).

---

## 5. UX/UI & Polish Opportunities

### U1 — AccountSelector dropdown shows only bots, not accounts
[`AccountSelector.tsx#L116-L175`](components/ui/AccountSelector.tsx#L116) lists enabled bots. There's no header section labeling them by account, and no way to see "all bots on `paper-100k`" grouped together. Visual hint: prefix each bot row with the account's color dot AND group by account with a tiny separator. With 6+ bots the flat list will scroll. **Effort: Small.**

### U2 — Settings page doesn't link to `/bots`
The Settings page only mentions Display/Live/Defaults/Notifications/Mascot/Strategy/Alerts/Discord/Import. No reference to Accounts or Bots. New users will never discover `/bots` unless they notice the nav link. Add an "Accounts & Bots → managed at /bots" card. Same with the Settings copy bug — it points to `memory/dashboard-settings.json` ([`app/settings/page.tsx#L17`](app/settings/page.tsx#L17), [`SettingsForm.tsx#L92-L94`](components/settings/SettingsForm.tsx#L92)) but the actual file is at `memory/shared/dashboard-settings.json`. **Effort: Trivial.**

### U3 — SaveSnippet modal asks user to copy env vars but doesn't explain WHY
[`BotsManager.tsx#L505-L564`](components/bots/BotsManager.tsx#L505) tells the user "paste these into Claude Code routine config". A user just signing up for paper trading has no idea what "Claude Code routine config" is. Add a one-line explanation: "These let the cloud routines (auto-running 6 AM through 4 PM CT) reach this account. **You can ignore these if you only want to view this account in the dashboard.**" Also: the snippet is not strictly needed when the dashboard is local-only — make it collapsible.

### U4 — Bot card "memory under memory/<id>/ will remain" delete copy is misleading
[`BotsManager.tsx#L193`](components/bots/BotsManager.tsx#L193) — after a delete, the memory tree at `memory/<botId>/` is still there and the next-created bot with the same id silently inherits it. That's intentional but surprising; either offer a checkbox "also delete `memory/<botId>/`" or warn explicitly: "Memory tree preserved — re-creating a bot with id `momentum-10k` will pick up its old TRADE-LOG."

### U5 — `LiveConfirmDialog` says "you will not be asked again this session" but doesn't surface that promise
[`AccountSelector.tsx#L243-L248`](components/ui/AccountSelector.tsx#L243). It's per-session via `sessionStorage`. Show a "Don't ask again this session" checkbox so the user opts in (consent UX) and add a way to revoke from Settings → Display.

### U6 — Mascot mood doesn't react to multi-bot context
With N bots, the mascot still picks one bot's day-pct. A mascot that says "5 bots green today, 1 red" is a much better signal than "bullish — `paper`'s up 0.4%". **Effort: Medium** — feed the mascot an aggregate.

### U7 — No empty state for `OrderEntryTile` when no account is bound
If a user lands on `/` with no enabled bots, the tile renders silently broken (no equity, blocked submit). Show a CTA: "Pick a bot from the top-right selector or visit /bots to add one."

### U8 — Calendar's `etTimeStringToCT` handle is silently wrong on DST transition rows
[`time.ts#L126-L164`](lib/time.ts#L126) probes ET offset with `Intl.DateTimeFormat({timeZone: "America/New_York"})` — but the probe uses the date's noon UTC, so the few minutes around 2 AM ET on transition Sundays could resolve to the wrong offset for a 7 AM ET event. Use the event's actual hour, not noon, when building the probe. **Effort: Small.**

### U9 — Dashboard grid layout reset is per-page; no "reset all"
[`useGridLayout.ts#L123-L127`](components/layout/useGridLayout.ts#L123) — each page tracks its own. After multiple grid edits, users may want a single "Reset all dashboard layouts" button in Settings → Display.

### U10 — Tab keyboard nav missing on `/trades` and `/analytics`
The custom `UrlTabs` component is keyboard-friendly only for click — Tab/Enter doesn't toggle. Worth a sweep on accessibility.

### U11 — "Force exit" UX is the same look-and-feel as "Tighten trail"
Same button class, same modal. But one is destructive (hits market sell), the other is preventative. Force-exit should be visually distinct (more red, more friction).

---

## 6. Performance & Scalability Issues

### P1 — `loadStrategyState` calls Alpaca for every poll, no cache
See A3. With many bots × many tabs this multiplies. Add server-side memoization keyed by `(botId, lastMemoryFingerprint)`.

### P2 — `getBotPositions` fetches 500 orders per call
[`perBotPositions.ts#L66-L68`](lib/bots/perBotPositions.ts#L66) — `--status=closed --limit=500` on every call. With 1000+ orders historically, the older fills won't be attributed at all (silent partial state). Add a date filter (`--after=<bot.createdAt>`) and consider caching the netted state in a `BACKTEST-RESULTS.json`-style file the bot's TRADE-LOG can be checked against.

### P3 — Backtest engine re-runs every closed trade against live bars on click
[`app/api/backtest/run/route.ts`](app/api/backtest/run/route.ts) — already noted. Heavy. The Run Fresh button in the UI doesn't show progress. Add SSE-driven progress streaming (every Nth trade) and a "running…" lock so concurrent clicks don't double-fire.

### P4 — `LiveRefresh` calls `router.refresh()` on every memory file change
[`components/LiveRefresh.tsx#L8-L10`](components/LiveRefresh.tsx#L8) — chokidar fires for `BENCHMARK.md`, `TRADE-LOG.md`, `RUN-LOG.jsonl` writes. With 5 active bots each writing on every routine, that's 50+ refreshes per cron cycle, each one re-running every server component on the page (Overview re-fetches Alpaca, sector ledger, earnings, etc). Debounce server-side in `watch.ts` (collect 500ms of events into one push) AND filter client-side: only refresh if the changed file's `bot` matches the active bot. **Effort: Small**, large impact.

### P5 — `useTradingAccountContext` always fetches `/api/bots` and `/api/accounts` on every page load
[`tradingAccountContext.tsx#L71-L80`](lib/tradingAccountContext.tsx#L71) — two SWR fetches at every mount of the layout. Cache these in `<SettingsProvider>` and pass them down (the redacted-settings response already includes `accounts` and `bots` — just hand them to `<TradingAccountProvider>` from `app/layout.tsx`).

### P6 — Mascot's hysteresis state lives in a `useRef` that's reset on remount
[`useBullMood.ts#L148-L191`](components/mascot/useBullMood.ts#L148). When the user switches bots, the entire client subtree re-mounts (because the URL changes via `router.push` not `router.replace` in `commit()` — [`tradingAccountContext.tsx#L126`](lib/tradingAccountContext.tsx#L126)), wiping the mood hysteresis. Use `router.replace` since the new bot is a peer view, not a back-button-able navigation; also persist the hysteresis state to `sessionStorage` keyed by botId.

### P7 — Grid layout uses synchronous `localStorage.getItem` on every `isCustom` read
[`useGridLayout.ts#L129`](components/layout/useGridLayout.ts#L129) — `isCustom = hydrated && readStored(pageId) !== null`. `readStored` JSON-parses every render. Memoize.

### P8 — The dashboard polls Alpaca's `/clock` from many components
`useMarketIsOpen`, `MarketClock`, `LiveConfirmDialog`. SWR dedupes by URL (good) but the deduplication doesn't help if those components mount with different `mode` values. Consolidate behind a single global hook fed from one SWR key.

---

## 7. Detailed Findings by Area

### 7.1 Layout & root (`app/layout.tsx`, `Nav.tsx`, `TopToolbar.tsx`)

- [`app/layout.tsx#L41-L43`](app/layout.tsx#L41) silently picks `initialAccount` as `paper` if `defaults.defaultAccountMode === 'paper'`, regardless of which bots are enabled. After C1 fix, this should resolve to the user's preferred bot id (could be `momentum-10k`), not raw `AlpacaMode`. **Severity: Medium.**
- [`Nav.tsx#L17-L25`](components/Nav.tsx#L17) — `/bots` is in the main nav (good), but there's no nav badge for "configuration drift" — e.g., a bot with `enabled=true` whose account is unreachable should show a red dot on the Bots nav item.
- [`TopToolbar.tsx#L10`](components/ui/TopToolbar.tsx#L10) — `MemoryFreshness` only knows about live/paper modes (the prop type is `AlpacaMode`). New bots' memory freshness is invisible. **Severity: Medium.**

### 7.2 Overview page (`app/page.tsx`, `components/layout/overview/registry.tsx`)

- [`app/page.tsx#L36, 62-63`](app/page.tsx#L36) — uses legacy `ACCOUNT_TABS = ["live","paper"]` + `activeTab`, NOT `resolveBotCtx`. So the Overview page literally cannot show a `momentum-10k` bot's data; switching the dropdown to `momentum-10k` will resolve `accountMode` to `live` (via the `else` fallback in `activeTab`) and silently render the live env account. **Severity: Critical** (largest user-visible bug after C1).
- [`page.tsx#L66`](app/page.tsx#L66) loads `loadBenchmark({bot: accountMode})` — same issue: never reads memory for non-`live`/`paper` bots.
- [`registry.tsx`](components/layout/overview/registry.tsx) — the tile context is `{accountMode}`, an `AlpacaMode`. Replacing with `{botId, accountId, mode}` is the natural follow-up and unblocks per-bot tile rendering.
- [`registry.tsx#L121-L125`](components/layout/overview/registry.tsx#L121) — `risk-gate` tile is laid out at the same default y/h as a KPI row beneath it (`y: 7, h: 5`) which collides with the KPI tiles at `y: 7, h: 3`. Default layout overlap will be visually messy until vertical compaction kicks in.

### 7.3 Trades page (`app/trades/page.tsx`, `TradesTable.tsx`)

- [`trades/page.tsx#L32, 73-74`](app/trades/page.tsx#L32) — same legacy `ACCOUNT_TABS` pattern. **Severity: Critical** (mirrors C1).
- The "Live concentration" sub-section ([`L424-L443`](app/trades/page.tsx#L424)) uses `loadResearchLog({bot: mode})` — same drift.
- No filter UI for trade source bot — once multiple bots run, the trades table can't be split by which bot fired the trade. Add a `botId` column derived from `client_order_id` prefix.

### 7.4 Analytics page (`app/analytics/page.tsx`)

- Good news: this one DOES use `resolveBotCtx` ([`L67`](app/analytics/page.tsx#L67)) — model citizen. Also threads the strategy slug into all child tabs.
- Bug: Backtest tab's `RunFreshButton mode="paper"` ([`L465`](app/analytics/page.tsx#L465)) is hardcoded — see C3.
- The `bestWorst`, `monthlyAggregates`, `streaks` math uses `new Date(closed[0].date).getTime()` which is timezone-naive — tradesPerWeek calc on [`L235-L242`](app/analytics/page.tsx#L235) is fine in practice but could mis-bucket trades around DST. Use `addDaysISO` style.

### 7.5 Calendar page (`app/calendar/page.tsx`, `components/calendar/`)

- Uses `resolveBotCtx` correctly ([`calendar/page.tsx#L23`](app/calendar/page.tsx#L23)).
- [`UpcomingEventsCard.tsx#L48-L51`](components/calendar/UpcomingEventsCard.tsx#L48) renders `dow` via `fmtWeekdayShortCT` — good.
- The `RefreshEconomicButton` and `RefreshMarketEarningsButton` are bot-agnostic (refresh shared files) — correct.

### 7.6 Journal page (`app/journal/page.tsx`)

- Uses `resolveBotCtx` correctly ([`L39`](app/journal/page.tsx#L39)).
- [`L116-L120`](app/journal/page.tsx#L116) — cooldown badge uses ledger of the active bot only. Correct.
- Routines tab ([`L289`](app/journal/page.tsx#L289)) reads RUN-LOG per-bot — correct, but doesn't surface a multi-bot summary (see F6).
- Daily tab reads `loadDailySummaries()` which has no `MemoryCtx` parameter. Daily summaries today are bot-agnostic (cross-bot). Once the routines emit per-bot daily summaries (Phase 2 in pre-market.md), add a bot filter here.

### 7.7 Settings page (`app/settings/page.tsx`, `components/settings/`)

- Path doc bug — see U2.
- No section for accounts/bots (see U2).
- No vault-key warning (see F5).
- [`AlertsSection.tsx`] — the `rule-violation` and `drawdown-breaker` types don't actually fire from the watcher ([`useAlertWatcher.ts#L75-L107`](lib/useAlertWatcher.ts#L75)) — they're acknowledged TODO. Either ship the dispatcher or hide them from the UI to avoid confusing users who enable them and see nothing happen.

### 7.8 Strategy page (`app/strategy/page.tsx`)

- Correctly uses `resolveBotCtx` ([`L14`](app/strategy/page.tsx#L14)).
- Read-only — fine. Could add a "Promote to live" button per F4.

### 7.9 Bots page & manager (`app/bots/`, `components/bots/`)

- The `/bots` page is the cleanest part of the new system. Manager has all the right primitives (test creds, allocation hint, env-var snippet).
- Missing: "test" button on **existing** bots (re-verify creds work) — currently only on the form. Useful when an account stops working.
- Missing: route for editing a bot's name / strategySlug / allocation. The PATCH endpoint exists ([`bots/[id]/route.ts#L16-L34`](app/api/bots/[id]/route.ts#L16)) but the UI only exposes Toggle / Delete.
- Missing: CSV export of all bots' equity for offline analysis.
- [`BotsManager.tsx#L188`](components/bots/BotsManager.tsx#L188) refreshInterval 30s on equity is fine; should drop when market is closed (use `useLiveSwr`).

### 7.10 Live tiles (`components/live/`)

- Every tile has the C1/C2 issue. Highest-impact files:
  - [`PnlHero.tsx`](components/live/PnlHero.tsx)
  - [`PositionManagementTile.tsx`](components/live/PositionManagementTile.tsx)
  - [`OrderEntryTile.tsx`](components/live/OrderEntryTile.tsx)
  - [`tiles/EquityKpiTile.tsx`](components/live/tiles/EquityKpiTile.tsx) and siblings
  - [`tiles/AccountIdentityTile.tsx`](components/live/tiles/AccountIdentityTile.tsx) — uses `detectAccountInfo(mode)` which is the legacy probe.
- [`OrderEntryTile.tsx#L50-L55`](components/live/OrderEntryTile.tsx#L50) — `equity` comes from raw account summary, not virtual equity. For an allocated bot, this means rule #19 sizing math (`% of equity`) operates on the **whole account's** equity, not the bot's `$10k` slice. So a "10k slice on a 100k paper account, score 9" picks `$18k` → over-allocates the slice 1.8x. **Severity: Critical** in the multi-bot world (silently makes soft allocation meaningless). Fix: pull from `botEquity()` virtual equity when `bot.allocation != null`.

### 7.11 Mascot (`components/mascot/`)

- [`useBullMood.ts#L139`](components/mascot/useBullMood.ts#L139) — same C1 issue (hardcoded `mode` to positions).
- [`BullMascotTile.tsx#L33`](components/mascot/BullMascotTile.tsx#L33) — the `mode` prop should be replaced with `botCtx`.
- The `level`/`recordPeakLevel` logic ([`mascot/level.ts`]) is global — peak level isn't per-bot, so a $10k slice can never gain levels at the same pace as a $100k slice. May or may not be intentional; if intentional, document.

### 7.12 AI (`components/ai/`, `lib/ai/`)

- [`ChatPanel.tsx#L41`](components/ai/ChatPanel.tsx#L41) doesn't pass `?account=` → see C5.
- [`DrawdownNarrator.tsx#L7-L10`](components/ai/DrawdownNarrator.tsx#L7) takes `account: AlpacaMode` and feeds to `getDrawdownNarrative({bot: account})` — won't work for non-`live`/`paper` bots (memory dir won't exist, will fall back to empty narrative).
- [`PostMortemPopover.tsx`] — same pattern; needs the bot ctx.
- AI cache logging ([`promptCache.ts`]) is great — keep it. Worth surfacing cache-hit rate in `/journal`.

### 7.13 Discord brief (`app/api/discord/brief/route.ts`, `lib/discord/brief.ts`)

- Brief route correctly uses `resolveBotCtx` ([`brief/route.ts#L78`](app/api/discord/brief/route.ts#L78)) and the proper runOpts shape — good.
- [`brief/route.ts#L139-L150`](app/api/discord/brief/route.ts#L139) — the week-breaker calc uses `latestDate.getDay()` and raw `Date` arithmetic. **CT-violation.** Replace with `dayOfWeekCT()` and `currentWeekMondayCT()` from `lib/time.ts`. **Severity: High** (hard invariant from spec; also: `getDay()` is timezone-naive per host, so this could swing weekends on hosts in non-CT zones).

### 7.14 API routes (`app/api/`)

- Good consistency: `dynamic = "force-dynamic"`, `runtime = "nodejs"` everywhere needed.
- [`api/alpaca/[cmd]/route.ts`](app/api/alpaca/[cmd]/route.ts) — defensive validation, good.
- [`api/accounts/[id]/test/route.ts#L32`](app/api/accounts/[id]/test/route.ts#L32) — `test-staging-` accounts persisted in settings JSON during the test. If the process is killed between `addAccount` and cleanup, the JSON is dirty until next test. The sweep-on-each-call mitigates but consider an in-memory test path (a `runAlpacaWithCreds(rawKey, rawSec, endpoint)` variant that doesn't touch settings).
- [`api/settings/import/route.ts`] — make sure it cannot import a settings file that overwrites existing accounts/bots (otherwise an import accidentally drops vault entries the user can't recover). The schema today allows it ([`settings.schema.ts#L361-L363`](lib/settings.schema.ts#L361)).

### 7.15 Time helpers (`lib/time.ts`)

- Excellent — comprehensive, well-named.
- [`time.ts#L146-L163`](lib/time.ts#L146) — see U8 for the DST edge case.
- One micro-violation in `app/api/discord/brief/route.ts` (above).

### 7.16 Memory layout (`lib/memoryPath.ts`, `lib/watch.ts`)

- Good schema definition. See A6 for watcher gap.
- See A10 for EARNINGS-CALENDAR scoping.
- The `MEMORY_FILE_SCOPE` registry is opt-in via filename — good. Document that adding a new memory file requires a registry entry.

### 7.17 Bash wrapper integration (`scripts/`)

- [`/Users/dietz/Desktop/Apps/bull-stock-trader/scripts/alpaca.sh#L53-L100`](../scripts/alpaca.sh) handles `--account-id` properly with namespaced env-var fallback to legacy.
- [`/Users/dietz/Desktop/Apps/bull-stock-trader/scripts/bots.sh`](../scripts/bots.sh) reads `memory/shared/dashboard-settings.json` ✓ and emits TSV — clean integration.
- The dashboard's `runAlpaca({accountId})` and the wrapper's `--account-id=<slug>` agree on slug → namespaced env-var. Good contract; document it in the Bots page so users understand why the env-var snippet exists.

### 7.18 Settings schema (`lib/settings.schema.ts`)

- See C4 (missing categories) and A8 (no allocation-sum check).
- [`L120`](lib/settings.schema.ts#L120) — `holdMaxDays` defaults to 30 but no rule in the codebase actually enforces it. Either wire it in or remove from the schema (looks like an unfinished feature).

### 7.19 Backtest (`lib/backtest/`)

- See C3.
- The runner is single-bot — once C3 is fixed, consider a `/api/backtest/run-all` that fans out across enabled bots.

---

## 8. Actionable Next Steps (Prioritized)

### Wave 1 — Critical: stop the bleeding (~1-2 days)

1. **Patch C2 (alpacaApiUrl undefined trap).** In [`lib/alpacaMode.ts`](lib/alpacaMode.ts), throw or return a known "skip" sentinel when both `mode` and `accountId` are undefined; same for `runAlpaca`. Add a unit test covering "unresolved bot id returns null SWR key". **Effort: Small.**
2. **Patch C1 (live tiles + writes ignore bot binding).** Thread `accountId` through `useTradingAccount()` consumers. New helper: `useActiveAlpacaQuery(cmd)` that builds the right URL. Update `OrderEntryTile.submit`, `PositionManagementTile.close`/`tighten` to send `{accountId, botId}`. **Effort: Medium.**
3. **Patch C5 (strategy-state/chat don't pass bot).** `useStrategyState()` takes `(botId)`; same for the chat panel's fetch. **Effort: Small.**
4. **Patch the OrderEntryTile sizing bug** — pull equity from `/api/bots/[id]/equity` when bot has an allocation. **Effort: Small.**
5. **Fix Overview & Trades pages to use `resolveBotCtx`** — drop `ACCOUNT_TABS` literal and `activeTab<AlpacaMode>` for the `account` param. **Effort: Small** (just like Analytics already does).
6. **Fix the `getDay()` violation** in `app/api/discord/brief/route.ts`. **Effort: Trivial.**
7. **Patch C3 (backtest hardcodes mode as bot).** **Effort: Small.**
8. **Patch C4 (add `stops`/`auth-canary`/`alert` categories).** **Effort: Trivial.**

### Wave 2 — High-leverage UX (~1-2 days)

9. Vault key health banner (F5).
10. Settings page link to `/bots` + path doc fix (U2).
11. AccountIdentityTile uses `detectAccountInfoById(accountId)` instead of legacy mode probe (A2).
12. Bot card "Edit" action surfaced (use existing PATCH).
13. Group AccountSelector dropdown by account (U1).
14. Empty-state for `/bots` page when no accounts.

### Wave 3 — Architectural cleanup (~3-5 days)

15. Refactor `lib/watch.ts` to be registry-aware (A6).
16. Server-side strategy-state cache (A3, P1).
17. Debounce `LiveRefresh` (P4).
18. Move accounts+bots into `<SettingsProvider>` (P5).
19. Extract `resolveOrderIdentity` helper (A5).
20. Rename `?account=` → `?bot=` with shim (A4).
21. Replace `AlpacaMode` props with `BotCtx` props in waves (A1).

### Wave 4 — Net-new features (each 1-3 days)

22. F1: `/bots/compare` view.
23. F2: cross-bot leaderboard on `/bots`.
24. F4: Promote-to-live workflow.
25. F6: per-bot routine grid in `/journal`.
26. F8: cross-bot backtest.

### Wave 5 — Polish (each ½-1 day)

27. F3 allocation slider.
28. F7 sandbox sentinel.
29. F9 strategy diff.
30. F10 per-bot Discord webhook.
31. U6 multi-bot mascot mood.
32. U10 keyboard nav on tabs.
33. U11 visual differentiation of destructive actions.

---

### Findings count

| Severity | Count |
|---|---|
| Critical | 6 |
| High | 9 |
| Medium | 14 |
| Low | 19 |

Critical: C1, C2, C3, C5, "Overview/Trades use legacy ACCOUNT_TABS" (7.2/7.3), and OrderEntryTile virtual-equity sizing bug (7.10).
High: C4, A1, A2, A3, A6, P1, P4, 7.13 brief getDay violation, 7.10 AccountIdentityTile.
Medium / Low: balance of A/F/U/P entries.
