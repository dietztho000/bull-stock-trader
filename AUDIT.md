# Bull Stock Trader — Whole-Repo Audit

_Generated 2026-05-03 by Codebase Auditor agent against `/Users/dietz/Desktop/Apps/bull-stock-trader/` — successor to the dashboard-only audit at [dashboard/AUDIT.md](dashboard/AUDIT.md)._

> File paths in this report are **repo-root-relative**.

---

## 1. Executive Summary

The dashboard-side multi-bot remediation is now ~90% landed: the prior audit's six Critical findings (C1–C5 + the OrderEntryTile virtual-equity bug) are all fixed in code, and almost every dashboard tile, page, and API route now flows through `resolveBotCtx` / `useTradingAccount()`. The new ground (`scripts/bots.sh`, registry-driven routine fan-out, `memory/<bot>/<strategy>/` migration, launchd deployment, vault) is well-engineered. **However, the bash-side fan-out has a Critical layering bug**: `_lib.sh memory_dir_for()` keys off `$BOT_MODE` (the bot's underlying account mode, e.g. "paper") rather than `$BOT_ID` (the registry slug, e.g. "momentum-10k"). Any routine running for a custom-named bot writes its `RUN-LOG.jsonl` and `.price-monitor-state.json` to `memory/paper/default/` — collapsing N bots' run-log heartbeats into a shared file the dashboard can never split apart. There are also two hard-rule violations on the sharing side: (a) `scripts/perplexity.sh` does NOT grep-first and so the routine docs' claim that "the 2nd, 3rd, … bot iterations skip the duplicate Perplexity call" is wishful thinking — every bot fan-out makes its own paid Perplexity call; (b) `scripts/sync-cloud-memory.sh` hardcodes `BOTS=(live paper)` so cloud-routine writes from a `momentum-10k` bot never make it into local main. Top-level docs (README, FLOW) are stale relative to the 10-routine, 2-mode, multi-bot reality.

---

## 2. Top 5 Critical Gaps

### G1 — `_lib.sh memory_dir_for()` uses `$BOT_MODE`, not `$BOT_ID` — multi-bot RUN-LOG fan-out is silently broken

**Why it matters.** The whole point of registry-driven fan-out is that bots have distinct ids and distinct memory trees. But `[scripts/_lib.sh:13-18](scripts/_lib.sh#L13)` derives the memory dir from `${BOT_MODE:-live}`, and the routine fan-out exports `BOT_MODE` as the bot's *account mode* (live|paper) — see [bots.sh:55-57](scripts/bots.sh#L55) which emits `mode` as the trailing column, picked up by every routine's `while IFS=$'\t' read -r BOT_ID ACCOUNT_ID STRATEGY BOT_ALLOCATION BOT_MODE` loop ([market-open.md:20](.claude/commands/market-open.md#L20)). So `[scripts/run-log.sh:19](scripts/run-log.sh#L19)` calls `memory_dir_for` and writes `memory/paper/default/RUN-LOG.jsonl` for every paper-backed bot — `momentum-10k`, `legacy-paper`, and any other custom paper bot all share one heartbeat file. The dashboard journal's per-bot routine grid ([CrossBotRoutineGrid.tsx](dashboard/components/journal/CrossBotRoutineGrid.tsx)) then can't actually split them.

**Affected.** [scripts/_lib.sh:13-18](scripts/_lib.sh#L13), [scripts/run-log.sh:19](scripts/run-log.sh#L19), [scripts/price-monitor.sh:27](scripts/price-monitor.sh#L27).

**Fix.** Change `memory_dir_for()` to `local bot="${BOT_ID:-${BOT_MODE:-live}}"` so the registry slug wins when set. One-line change. Add a short doc comment explaining the precedence. Effort: **Small**.

**Severity:** **Critical**.

---

### G2 — `scripts/perplexity.sh` has no idempotency guard; routine docs lie about cross-bot dedup

**Why it matters.** The `auth-canary.md` and `pre-market.md` preambles both claim: _"The grep-first idempotency rule on PERPLEXITY-LOG.md means the 2nd, 3rd, … bot iterations will skip the duplicate Perplexity call when today's answer is already cached."_ ([pre-market.md:33-38](.claude/commands/pre-market.md#L33)). But [scripts/perplexity.sh:36](scripts/perplexity.sh#L36) unconditionally appends a new row to `PERPLEXITY-LOG.md` and unconditionally fires `_curl_retry POST` — there is NO grep-first short-circuit. So with N enabled bots, every pre-market query (~8 of them) fires N times — 8N paid Perplexity calls, not the documented 8. The CLAUDE.md hard rule ("Memory write idempotency mandatory for all routines") is being violated by the wrapper.

**Affected.** [scripts/perplexity.sh:30-50](scripts/perplexity.sh#L30), [.claude/commands/pre-market.md:33-38](.claude/commands/pre-market.md#L33), [.claude/commands/auth-canary.md:36-41](.claude/commands/auth-canary.md#L36).

**Fix.** Either (a) move the grep-first/cache logic into `perplexity.sh` itself (key by `$DATE + sha256(query)`, scan today's PERPLEXITY-LOG rows, return the cached answer body), or (b) wrap calls in routines with a manual grep guard. Option (a) keeps the routine STEP content thin and respects the mandatory idempotency rule from CLAUDE.md. Effort: **Small-Medium**.

**Severity:** **Critical** (cost / rate-limit / hard-rule violation).

---

### G3 — `scripts/sync-cloud-memory.sh` hardcodes `BOTS=(live paper)` — custom bots never sync from cloud to local

**Why it matters.** The cloud routines push memory writes to `claude/<branch>` orphan branches when "Allow unrestricted branch pushes" is OFF. `cron-sync.sh` runs every 15 min via launchd to backfill those writes into local main. But [scripts/sync-cloud-memory.sh:22](scripts/sync-cloud-memory.sh#L22) hardcodes `BOTS=(live paper)`, meaning a `momentum-10k` cloud-routine push that only touches `memory/momentum-10k/default/TRADE-LOG.md` is invisible to the sync — the local dashboard sees an empty memory tree for that bot forever. Combined with G1 (RUN-LOG bleed), this means custom-named bots are second-class citizens on the cloud sync path.

**Affected.** [scripts/sync-cloud-memory.sh:22](scripts/sync-cloud-memory.sh#L22).

**Fix.** Read the bot list from `bash scripts/bots.sh list --include-disabled` (jq the slugs) instead of the hardcoded array. Same wildcard for shared-only branches. Effort: **Small**.

**Severity:** **Critical** (data-loss-equivalent: cloud writes silently never land locally).

---

### G4 — `scripts/auth-preflight.sh` decision to `continue` swallows the error with no per-bot run-log entry

**Why it matters.** The fan-out preamble is `bash scripts/auth-preflight.sh <routine> --account-id="$ACCOUNT_ID" || continue`. When preflight fails, the helper at [scripts/auth-preflight.sh:45](scripts/auth-preflight.sh#L45) calls `bash run-log.sh end "$routine" fail` — but `run-log.sh end` requires that a `start` was already emitted for the same iteration ([run-log.sh:30-33](scripts/run-log.sh#L30) just appends a row regardless). The footer in the routine wraps each iteration in its own `run-log.sh start <routine>`/`end` pair — but those calls are AFTER `auth-preflight`. So a failed-preflight bot gets a single `end fail` row with no preceding `start`, which the daily-summary EOD watchdog (also implicitly) reads as "routine never started". Bot is effectively invisible in the run-log timeline.

**Affected.** [scripts/auth-preflight.sh:43-45](scripts/auth-preflight.sh#L43), [.claude/commands/market-open.md:23](.claude/commands/market-open.md#L23) (every routine), [routines/_cloud-footer-market-open.md](routines/_cloud-footer-market-open.md).

**Fix.** Emit a `run-log.sh start` BEFORE the preflight inside the fan-out loop, OR have `auth-preflight.sh` emit both rows (start with a "preflight" marker, then end fail). Add a `routine: "<routine>:preflight-fail"` discriminator so the dashboard can tell preflight failures from in-flight failures. Effort: **Small**.

**Severity:** **High** (verging on Critical — silent failures are worse than loud ones for a trading bot).

---

### G5 — `scripts/price-monitor.sh` is single-bot; multi-bot users get no early-warning coverage on their other bots

**Why it matters.** [scripts/price-monitor.sh:21-37](scripts/price-monitor.sh#L21) reads `memory_dir_for` (i.e. `BOT_MODE` from the launchd plist env) and calls bare `bash scripts/alpaca.sh positions` with no `--account-id`. So `com.bullstocktrader.price-monitor.plist` only watches whichever account `BOT_MODE` resolves to (live, by default) — `momentum-10k`, `paper-100k`, and any other registered bot get **zero** -5%/-6%/-7% early-warning Discord alerts. This is rule #18's intent broken silently in multi-bot mode.

**Affected.** [scripts/price-monitor.sh:31-51](scripts/price-monitor.sh#L31), [scripts/launchd/com.bullstocktrader.price-monitor.plist](scripts/launchd/com.bullstocktrader.price-monitor.plist).

**Fix.** Wrap the body in the same `bash scripts/bots.sh list | while read …` fan-out the routines use, with per-bot state files at `memory/$BOT_ID/$STRATEGY/.price-monitor-state.json`. Each iteration gates its own `clock` call. Effort: **Small-Medium**.

**Severity:** **High** (missing a -7% bucket on a non-default bot is exactly the cost-of-missed-alert scenario rule #18 was designed to prevent).

---

## 3. Missed Feature Opportunities

### F1 — Cloud routine status dashboard tile by bot × routine grid
The journal page now has [CrossBotRoutineGrid.tsx](dashboard/components/journal/CrossBotRoutineGrid.tsx), but RUN-LOG.jsonl writes for non-live/paper bots all collapse into one file (G1 above). Once G1 is fixed, surface this grid as a **Glance-page** tile so the operator sees cron health at a glance from their phone. Effort: **Small**.

### F2 — Auto-rotate vault key every N days
[dashboard/lib/vaultRekey.ts](dashboard/lib/vaultRekey.ts) and [VaultKeyRotateButton.tsx](dashboard/components/bots/VaultKeyRotateButton.tsx) exist; missing is the schedule. Add a settings field "Rotate every N days" + a launchd job that calls a `/api/vault/rekey` endpoint with the new key, mirrors to `.env`, and posts an auth-canary-style Discord. Effort: **Medium**.

### F3 — Per-routine "skip this bot" toggle
Today every enabled bot runs every routine. A user iterating on `momentum-10k` may want it to skip daily-summary while still firing market-open. Add `bot.routineFilter: { 'pre-market': true, 'market-open': true, ... }` and gate the fan-out preamble on it. Effort: **Small**.

### F4 — Cloud routine schedule editor in `/bots`
The cron schedule lives outside the repo (in the cloud routine's UI). A `/bots/<id>/schedule` page that calls the cloud API to read/write the schedule would make schedule drift visible. Effort: **Medium-Large** depending on cloud API surface.

### F5 — Backtest-vs-live overlay on `/bots` cards
The backtest snapshot ([dashboard/lib/backtest/cache.ts](dashboard/lib/backtest/cache.ts)) is per-bot now. Show it as a sparkline alongside the live equity sparkline on each `/bots` card so the operator sees "live vs backtest expected" at a glance. Effort: **Small**.

### F6 — Discord brief: per-bot toggle which categories to send
The schema has `webhookCategoryFilters` ([settings.schema.ts:60-72](dashboard/lib/settings.schema.ts#L60)) globally; bots have `discordWebhookUrl` overrides ([settings.schema.ts:209](dashboard/lib/settings.schema.ts#L209)). Cross-product: per-bot category filters. So `momentum-10k` sends fills only, `legacy-live` sends everything. Effort: **Small**.

### F7 — Wire `rule-violation` and `drawdown-breaker` alert dispatchers
[useAlertWatcher.ts:75-79](dashboard/lib/useAlertWatcher.ts#L75) and [:103-107](dashboard/lib/useAlertWatcher.ts#L103) explicitly TODO these. Settings UI exposes them, so users enabling "drawdown-breaker" toast see no toast — silent surprise. Either ship the dispatcher or hide them from the UI. Effort: **Small** to hide; **Medium** to ship.

### F8 — Server-side dispatcher for Discord/ntfy alert delivery
Same file: `// Discord/ntfy delivery is intentionally not wired here — server-side dispatcher is a follow-up.` ([useAlertWatcher.ts:40-41](dashboard/lib/useAlertWatcher.ts#L40)). Without this, the schema's `channels.discord` / `channels.ntfy` toggles do nothing. Effort: **Medium**.

### F9 — Promote-flow: rollback button + diff history
[PromoteModal.tsx](dashboard/components/bots/PromoteModal.tsx) and [/api/bots/promote/route.ts](dashboard/app/api/bots/promote/route.ts) ship the forward path. Add `memory/shared/PROMOTION-LOG.jsonl` + a "Rollback last promotion" button that re-applies the prior `TRADING-STRATEGY.md` text. Effort: **Small**.

### F10 — `routines/<name>.md` round-trip CI gate
`scripts/build-routines.sh` is the source-of-truth regenerator, but nothing enforces "regenerate then commit". A CI step (or even a `pre-push` git hook) that runs the script and `git diff --exit-code` would prevent stale routines from shipping. Effort: **Trivial**.

### F11 — Status badge per launchd job in `/bots`
Surface the 3 launchd plists (cloud-sync, log-rotate, price-monitor) with last-run-at + ok/fail derived from `~/Library/Logs/bull-stock-trader-*.log` tail. Today the user discovers a stuck cron-sync only after noticing dashboard staleness. Effort: **Small** if reading via a small `/api/health/launchd` route.

### F12 — Soft-allocation enforcement (not just warning)
[settings.ts:165-181](dashboard/lib/settings.ts#L165) does not enforce `sum(bot.allocation) <= account.totalCapital`. Add an opt-in toggle "Hard-cap account: refuse the order if the slice would over-deploy". Pairs with the existing OrderEntryTile virtual-equity check. Effort: **Small**.

---

## 4. Architectural & Code Quality Recommendations

### A1 — Move `BOT_ID`-vs-`BOT_MODE` precedence into `_lib.sh` once and for all
G1's root cause is that the bash side has two slightly different concepts ("bot identity" and "credential mode") that the dashboard side has fully separated but that bash conflates via `BOT_MODE`. Rename `memory_dir_for()` to take an explicit `bot` arg or add `_resolve_bot_id` that tries `BOT_ID` then falls back to `BOT_MODE`. Document the contract at the top of `_lib.sh`. Effort: **Small**.

### A2 — `bots.sh list` should expose a JSON mode for machine consumers
[scripts/bots.sh:50-59](scripts/bots.sh#L50) emits TSV. Cloud routines parse it with `read -r`; the dashboard's `/api/bots` doesn't use this script at all (re-implements via `listBots()`). For non-bash consumers (e.g. a future Python migration or a status webhook), a `bash scripts/bots.sh list --json` mode would prevent format drift. Effort: **Small**.

### A3 — `.env` writeback for new accounts is missing
`BotsManager` shows users "paste this snippet into your cloud routine env" — but it doesn't update `.env` locally. So a new account is invisible to local routine runs until the user manually edits `.env`. Add an opt-in "Append to .env" button that writes the namespaced creds to `.env`. Effort: **Small**.

### A4 — `scripts/sync-cloud-memory.sh` should also detect non-memory paths it skipped
[sync-cloud-memory.sh:108-110](scripts/sync-cloud-memory.sh#L108) skips a branch if it touches non-memory paths but doesn't log to a structured place. Append a `memory/shared/SYNC-SKIPPED.jsonl` line so the user can audit "which cloud writes never landed?". Effort: **Trivial**.

### A5 — Missing CI/local check that `dashboard-settings.json` matches the schema
The dashboard reads/writes via `loadSettings`/`saveSettings`, but a hand-edit (or import from a stale dashboard) could push an invalid blob. Add a `bash scripts/check-settings.sh` that validates against `settings.schema.ts` (via `npx zx`/`tsx`) and runs in cron-sync's preflight. Effort: **Small**.

### A6 — Routine fan-out is loop-spaghetti — extract a shared `_routine-header.sh` source
Every routine begins with the same 14-line preamble (count check + while loop + auth-preflight). Any change (e.g. add `--strategy="$STRATEGY"` to alpaca.sh calls) requires editing 10 files plus the cloud header. Move it into `scripts/_routine-header.sh` and have each routine `source` it. Effort: **Small** but high blast-radius reduction.

### A7 — Document the bash↔dashboard shared contract
The bash wrapper's `--account-id` slug → namespaced env-var contract ([alpaca.sh:53-79](scripts/alpaca.sh#L53)) and the dashboard's `runAlpaca({accountId})` resolver agree, but the contract is only documented in code comments. Add a top-level `docs/multi-bot-contract.md` covering: env var naming convention, slug rules, BOT_ID semantics. Effort: **Small**.

### A8 — `scripts/_lib.sh _curl_retry` does not respect 429
[_lib.sh:101-103](scripts/_lib.sh#L101) treats all 4xx as terminal. But Alpaca returns 429 on rate limit, which IS retryable (with `Retry-After`). Carve a 429 branch with backoff. Same for Perplexity. Effort: **Small**.

### A9 — Drop the legacy `?account=` URL param after one release
[resolveAccount.ts:31-32](dashboard/lib/resolveAccount.ts#L31), [tradingAccountContext.tsx:116](dashboard/lib/tradingAccountContext.tsx#L116) accept `?account=` for back-compat; the comment says "one-release shim". Schedule a removal milestone — keeping the shim indefinitely doubles every reader's mental load. Effort: **Trivial** later.

### A10 — Two CT-helper violations remain in the dashboard
Survived from prior audit / new code:
- [components/journal/WeeklyReviewDraft.tsx:66](dashboard/components/journal/WeeklyReviewDraft.tsx#L66) — `new Date(resp.generatedAt).toLocaleTimeString()` (no `timeZone`).
- [components/calendar/CalendarView.tsx:378](dashboard/components/calendar/CalendarView.tsx#L378) — `first.getUTCDay()` for "what day is the 1st of this month" — for a calendar-grid offset, the `getUTCDate`-style ISO arithmetic is acceptable (per `dashboard/CLAUDE.md`'s "Pure ISO-date arithmetic is fine" carve-out), but a comment justifying it would prevent future audit churn.

### A11 — `dashboard/lib/migrations/seedFromEnv.ts` (referenced by prior A7) — verify slug-collision behavior post-rename
Prior A7 flagged that `seedFromEnv` writes fixed ids `live`/`paper` colliding with user-creatable bots. Need to verify the `memoryAlias` field added to [settings.schema.ts:196-199](dashboard/lib/settings.schema.ts#L196) actually solves it (rename seed bots to `legacy-live`/`legacy-paper`, alias memory to old paths). Spot-check confirmed `resolveBotCtx` honors `memoryAlias` ([resolveAccount.ts:83](dashboard/lib/resolveAccount.ts#L83)) — but the seed script itself wasn't read in this audit; carry forward as TODO.

---

## 5. UX/UI & Polish Opportunities

### U1 — Glance page lacks the force-exit / earnings banners
[/app/glance/page.tsx](dashboard/app/glance/page.tsx) renders PnlHero + MarketClock + LivePositions but skips ForceExitBanner and EarningsGateBanner. The whole point of the mobile view is "the things you'd act on right now" — those banners are exactly that. Add them. Effort: **Trivial**.

### U2 — Settings page still says memory file is at `memory/dashboard-settings.json` (now `memory/shared/`)
Prior audit flagged this. Spot-check [app/settings/page.tsx](dashboard/app/settings/page.tsx) and [components/settings/SettingsForm.tsx](dashboard/components/settings/SettingsForm.tsx) — likely still stale; verify and fix. Effort: **Trivial**.

### U3 — `/bots` page Promote button has no "rollback" affordance
[PromoteModal.tsx](dashboard/components/bots/PromoteModal.tsx) writes the live bot's strategy file from the paper bot's. If the user immediately regrets it, there's no in-app rollback — they have to use git. See F9.

### U4 — Bot card shows account label but not the live mode-tinted dot
A user with two paper bots and one live bot benefits from a stronger color cue at the card level (not just the badge in the dropdown). Effort: **Trivial**.

### U5 — `AllocationBar` ([dashboard/components/bots/AllocationBar.tsx](dashboard/components/bots/AllocationBar.tsx)) doesn't show "free" vs "over-allocated" clearly
A 110% allocation should show a 10% red "overflow" bar — not just total bar > 100% width. Effort: **Small**.

### U6 — `/bots/compare` page has no permalink for selected bots
[BotsCompare.tsx](dashboard/components/bots/BotsCompare.tsx) likely uses local state for the selected bot list. URL-encode it (e.g. `?compare=momentum-10k,legacy-paper`) so users can bookmark / share. Effort: **Small**.

### U7 — `MultiBotMoodLine` ([dashboard/components/mascot/MultiBotMoodLine.tsx:10-15](dashboard/components/mascot/MultiBotMoodLine.tsx#L10)) replaces the old single-bot mood
This is a U6 from prior audit, now landed (good). Verify the line always renders even on single-bot installs (one-bot reading should still show "1 green" not blank).

### U8 — `RotateAccountCredsModal` should warn about live cred loss
A user rotating live creds without the matching env-var update on the cloud side will silently break cloud routines until the next auth-canary fires (5 hours later). Add a checkbox "I have updated my cloud routine env vars". Effort: **Trivial**.

### U9 — `/strategy?compare=` page has no defaults
[StrategyCompareView.tsx](dashboard/components/strategy/StrategyCompareView.tsx) — verify it pre-selects the user's other-mode bot when no `?compare=` is set. Effort: **Trivial**.

### U10 — Force-exit banner missing on `/trades`
`ForceExitBanner` ([dashboard/components/live/ForceExitBanner.tsx](dashboard/components/live/ForceExitBanner.tsx)) only renders on the Overview registry. Trades page is where users go to investigate one — show it there too.

### U11 — `Nav.tsx` lacks a "needs attention" badge per page
After the `/bots` and Vault Banner work, there are now multiple "alerts the user should see": vault key fallback, sentinel-tripped bots, stale memory, drift'd allocation. Surface one persistent red dot on `Nav` when any are firing. Effort: **Small**.

---

## 6. Performance & Scalability Issues

### P1 — Cloud-sync runs every 15 min, full `git fetch` of `claude/*` refspec
[scripts/cron-sync.sh:51](scripts/cron-sync.sh#L51) `git fetch --quiet origin '+refs/heads/claude/*:refs/remotes/origin/claude/*'`. With 10 routines × N bots × M weeks, the orphan branch count grows unbounded. After ~6 months you'll have thousands of refs. Add a periodic `git for-each-ref --format='%(committerdate:unix) %(refname)' refs/remotes/origin/claude/ | awk '$1<NOW-90d {print $2}' | xargs -r git update-ref -d` cleanup. Effort: **Small**.

### P2 — `/api/bots/leaderboard` fans out `botEquity()` per bot serially or in parallel?
[/api/bots/leaderboard/route.ts:50](dashboard/app/api/bots/leaderboard/route.ts#L50) — verify it's `Promise.all` over `botEquity(bot.id)`. If sequential, with N bots and M cached-miss accounts, latency multiplies. Spot-check shows the call is in a list comprehension; confirm it's parallel. Effort: **Trivial** if needed.

### P3 — Per-account orders cache TTL=25s — but the SWR refresh is 30s
[perBotPositions.ts:39](dashboard/lib/bots/perBotPositions.ts#L39) sets `ACCOUNT_CACHE_TTL_MS = 25_000`. Leaderboard refreshes at 30s. Net effect: every leaderboard refresh is a cache miss, defeating the dedup. Bump TTL to ~35s OR coordinate with the leaderboard interval. Effort: **Trivial**.

### P4 — `getBotPositions` reads `closed` orders without an `--after=<bot.createdAt>` server-side filter
[perBotPositions.ts:84](dashboard/lib/bots/perBotPositions.ts#L84) — `runAlpaca("orders", ["closed"], …)` returns up to 100 (alpaca.sh:161 caps at limit=100). For an account with >100 closed orders, the older fills never land in the array, and the bot can never see fills older than the most recent 100. Combined with the client-side `botCreatedAtMs` filter, this means a brand-new bot might silently miss attribution on an account with high turnover. Add `--after=<bot.createdAt>` plumbing in alpaca.sh's `orders` subcommand. Effort: **Small**.

### P5 — `_curl_retry` retries 5xx but logs the body to `>&2` only on final failure
[_lib.sh:106-114](scripts/_lib.sh#L106) — silent retries are fine for the happy path but mask intermittent 5xx outages. Add a `WARN` line to stderr for each retry attempt (it's already there at L109, good). Verify launchd captures stderr to log file (cloud-sync.plist L46 — yes, good).

### P6 — Memory file watcher batches at 500ms
[dashboard/lib/watch.ts:45-46](dashboard/lib/watch.ts#L45) — 500ms is fine for one operator, but a multi-bot install where 5 routines flush 50 files within 1s will see 2 batches. Consider raising to 1500ms. Effort: **Trivial**.

### P7 — `loadStrategyState` on every poll re-reads files, no fingerprint cache
The prior P1/A3 finding (server-side caching of strategy state). Verify [dashboard/app/api/overview/strategy-state/route.ts](dashboard/app/api/overview/strategy-state/route.ts) — spot-check shows it calls `loadStrategyState({ bot, strategy })` per request. Add the fingerprint cache (mtime-based) that A3 prescribed. Effort: **Small**.

---

## 7. Detailed Findings by Area

### 7.1 Dashboard pages (`dashboard/app/`)

- [`app/page.tsx#L64`](dashboard/app/page.tsx#L64) — properly uses `resolveBotCtx`. Drops legacy `ACCOUNT_TABS`. **Prior 7.2 (Critical) RESOLVED.**
- [`app/trades/page.tsx#L80-L81`](dashboard/app/trades/page.tsx#L80) — uses `resolveBotCtx` AND `activeTab` only for the local Tab type. **Prior 7.3 (Critical) RESOLVED.**
- [`app/glance/page.tsx`](dashboard/app/glance/page.tsx) — new mobile-friendly view. Missing force-exit / earnings banners (U1). One stale comment: ([app/glance/page.tsx:23](dashboard/app/glance/page.tsx#L23)) "audit F9" — actually new feature, not in prior audit's F9 (which was strategy diff).
- [`app/bots/page.tsx`](dashboard/app/bots/page.tsx) — cleanly structured.
- [`app/bots/compare/page.tsx`](dashboard/app/bots/compare/page.tsx) — net-new. See U6.
- [`app/strategy/page.tsx`](dashboard/app/strategy/page.tsx) + [`components/strategy/StrategyCompareView.tsx`](dashboard/components/strategy/StrategyCompareView.tsx) — F9 from prior audit landed.

### 7.2 Dashboard components (`dashboard/components/`)

- [`components/live/PnlHero.tsx#L26-L47`](dashboard/components/live/PnlHero.tsx#L26) — accepts `accountId`, builds `idOpts` accordingly. **Prior C1/7.10 RESOLVED.**
- [`components/live/MarketClock.tsx#L16-L20`](dashboard/components/live/MarketClock.tsx#L16) — now reads `accountId` from `useTradingAccountOptional()`. **Prior 7.10 RESOLVED.**
- [`components/live/LivePositions.tsx#L106-L127`](dashboard/components/live/LivePositions.tsx#L106) — accepts `accountId` prop AND falls back to context. **Prior C1 RESOLVED.**
- [`components/live/OrderEntryTile.tsx#L67-L83`](dashboard/components/live/OrderEntryTile.tsx#L67) — uses virtual equity when allocation is set. **Prior 7.10 (Critical) RESOLVED.**
- [`components/live/OrderEntryTile.tsx#L172-L177`](dashboard/components/live/OrderEntryTile.tsx#L172) — order body sends `accountId` + `botId`. **Prior C1 RESOLVED.**
- [`components/mascot/MultiBotMoodLine.tsx`](dashboard/components/mascot/MultiBotMoodLine.tsx) — net-new, addresses prior U6.
- [`components/bots/VaultKeyBanner.tsx`](dashboard/components/bots/VaultKeyBanner.tsx) — net-new, addresses prior F5.
- [`components/bots/PromoteModal.tsx`](dashboard/components/bots/PromoteModal.tsx) — net-new, addresses prior F4.
- [`components/journal/CrossBotRoutineGrid.tsx`](dashboard/components/journal/CrossBotRoutineGrid.tsx) — net-new, addresses prior F6 BUT will show wrong data until G1 is fixed.
- [`components/settings/AlertsSection.tsx`](dashboard/components/settings/AlertsSection.tsx) — wires to schema; rule-violation/drawdown-breaker still TODO (F7).

### 7.3 Dashboard lib (`dashboard/lib/`)

- [`lib/alpacaMode.ts#L26-L40`](dashboard/lib/alpacaMode.ts#L26) — undefined-arg case returns `null` so SWR skips. **Prior C2 RESOLVED.**
- [`lib/resolveAccount.ts#L64-L93`](dashboard/lib/resolveAccount.ts#L64) — `resolveBotCtx` returns `{botId, memoryDir, strategy, accountId, mode}`. Honors `memoryAlias` for back-compat. **Prior 7.2/7.3 RESOLVED.**
- [`lib/resolveAccount.ts#L123-L163`](dashboard/lib/resolveAccount.ts#L123) — `resolveOrderIdentity` extracted and shared. **Prior A5 RESOLVED.**
- [`lib/useStrategyState.ts#L49-L53`](dashboard/lib/useStrategyState.ts#L49) — passes `?bot=` from context. **Prior C5 RESOLVED.**
- [`lib/watch.ts#L67-L91`](dashboard/lib/watch.ts#L67) — registry-aware classification of memory paths. **Prior A6 RESOLVED.**
- [`lib/watch.ts#L20-L33, L48-L98`](dashboard/lib/watch.ts#L20) — debounced (500ms) batches, per-batch SSE flush. **Prior P4 RESOLVED.**
- [`lib/tradingAccountContext.tsx#L110-L121`](dashboard/lib/tradingAccountContext.tsx#L110) — pulls bots/accounts from `SettingsProvider`, no extra fetch. **Prior P5 RESOLVED.**
- [`lib/tradingAccountContext.tsx#L173-L196`](dashboard/lib/tradingAccountContext.tsx#L173) — defaults to "live" for confirm-dialog. Good defensive change.
- [`lib/useAlertWatcher.ts#L75, L103`](dashboard/lib/useAlertWatcher.ts#L75) — `drawdown-breaker` and `rule-violation` cases still return `[]`. **F7 / prior 7.7 STILL OPEN.**
- [`lib/memoryPath.ts#L67`](dashboard/lib/memoryPath.ts#L67) — `EARNINGS-CALENDAR.md` still per-bot. **Prior A10 STILL OPEN** — but this is intentional given per-bot earnings exposure differs by held tickers.
- [`lib/bots/perBotPositions.ts:39`](dashboard/lib/bots/perBotPositions.ts#L39) — TTL=25s vs 30s refresh: see P3.
- [`lib/bots/perBotPositions.ts:84`](dashboard/lib/bots/perBotPositions.ts#L84) — no `--after` filter on `orders closed` — see P4.
- [`lib/accountVault.ts#L61, L65`](dashboard/lib/accountVault.ts#L61) — `isVaultUsingFallback`/`generateVaultKey` exposed. **Prior F5 RESOLVED.**

### 7.4 Dashboard API routes (`dashboard/app/api/`)

- [`app/api/backtest/run/route.ts#L42-L75`](dashboard/app/api/backtest/run/route.ts#L42) — uses `resolveBotCtx`, accepts `strategyBot` provenance for cross-bot backtest. **Prior C3 RESOLVED.**
- [`app/api/backtest/run/route.ts#L65-L72`](dashboard/app/api/backtest/run/route.ts#L65) — validates `strategyBot` exists. Good defensive code.
- [`app/api/discord/brief/route.ts`](dashboard/app/api/discord/brief/route.ts) — no remaining `getDay()` / `getUTCDay()` violations. **Prior 7.13 RESOLVED.**
- [`app/api/bots/promote/route.ts`](dashboard/app/api/bots/promote/route.ts) — net-new (F4 from prior).
- [`app/api/bots/leaderboard/route.ts`](dashboard/app/api/bots/leaderboard/route.ts) — net-new (F2 from prior).
- [`app/api/vault/health/route.ts`](dashboard/app/api/vault/health/route.ts), [`/generate-key/route.ts`](dashboard/app/api/vault/generate-key/route.ts), [`/rekey/route.ts`](dashboard/app/api/vault/rekey/route.ts) — net-new.
- [`app/api/ai/weekly-review-draft/route.ts`](dashboard/app/api/ai/weekly-review-draft/route.ts) — net-new; consumes `WeeklyReviewDraft.tsx` (which has the CT violation noted in A10).

### 7.5 Trading scripts (`scripts/`)

- [`scripts/alpaca.sh#L36-L100`](scripts/alpaca.sh#L36) — `--mode`/`--bot-id`/`--account-id` flag plumbing is clean. Slug → namespaced env-var derivation correct.
- [`scripts/alpaca.sh#L186-L193`](scripts/alpaca.sh#L186) — `submit-order` prefixes `client_order_id` with `${BOT_ID}-` when set. Good. (Ditto `replace-order` at L228-L231.)
- [`scripts/_lib.sh#L13-L18`](scripts/_lib.sh#L13) — **G1**: keys off `BOT_MODE`, not `BOT_ID`.
- [`scripts/perplexity.sh#L30-L50`](scripts/perplexity.sh#L30) — **G2**: no idempotency guard.
- [`scripts/sync-cloud-memory.sh#L22`](scripts/sync-cloud-memory.sh#L22) — **G3**: hardcodes `BOTS=(live paper)`.
- [`scripts/sync-cloud-memory.sh#L42-L77`](scripts/sync-cloud-memory.sh#L42) — defensive guards on branch contents (only memory/* paths). Good.
- [`scripts/cron-sync.sh#L31-L36`](scripts/cron-sync.sh#L31) — **rule #21 satisfied**: mkdir-based commit lock on `.git/.commit-lock.d`. Non-blocking, unlocks via trap. Cross-platform (vs flock-Linux-only). Prefer this pattern.
- [`scripts/cron-sync.sh#L46-L49`](scripts/cron-sync.sh#L46) — refuses to run with non-memory uncommitted changes. Good safety.
- [`scripts/cron-sync.sh#L52`](scripts/cron-sync.sh#L52) — `git pull --rebase origin main`. Implements the "retry pushes 3x with rebase" half of rule #21 implicitly via git's own rebase semantics — but the routine push side (cloud) needs to do this too; today it's manual.
- [`scripts/log-rotate.sh#L17-L29`](scripts/log-rotate.sh#L17) — keeps last 1000 lines. **Rule #22 implemented.**
- [`scripts/auth-preflight.sh#L43-L45`](scripts/auth-preflight.sh#L43) — **G4**: `run-log.sh end fail` without preceding `start`.
- [`scripts/bots.sh#L37-L72`](scripts/bots.sh#L37) — `list`, `count`, `env-namespace` subcommands. Clean, well-documented. See A2 for JSON variant.
- [`scripts/price-monitor.sh#L21-L51`](scripts/price-monitor.sh#L21) — **G5**: single-account in a multi-bot world.
- [`scripts/build-routines.sh`](scripts/build-routines.sh) — emits stable output (verified: regenerates with no diff). See F10 for CI gate.
- [`scripts/migrate-memory-layout.sh`](scripts/migrate-memory-layout.sh) — clear, idempotent, conflict-detecting. Top-tier migration script. One nit: `PAPER_SEED_COPY` ([:52](scripts/migrate-memory-layout.sh#L52)) only seeds 2 of 10 files; document why empty-seeding is safe (parsers handle empty). The doc comment at L188 covers it but could move higher.

### 7.6 Routine sources (`.claude/commands/`)

- 13 routines (10 cron + 3 ad-hoc: portfolio, benchmark, trade). Verified per-bot fan-out preamble in market-open, stops, auth-canary, pre-market.
- The fan-out preamble pattern is mechanically copy-pasted across all 10 — see A6 for extraction.
- [`market-open.md#L49-L64`](.claude/commands/market-open.md#L49) — STEP 2c effective_equity logic for soft-allocated bots is precise and explicit. Good doc.
- [`market-open.md#L70-L75`](.claude/commands/market-open.md#L70) — pre-market gap check (rule #15) properly cancels the stale stop. Good.
- [`stops.md#L37-L42`](.claude/commands/stops.md#L37) — within-5-min-of-close guard in routine STEP 1 (rule #4 / safety). Good.
- All 10 routines that touch memory have idempotency notes — but only via prose; the bash side doesn't actually enforce it (perplexity.sh G2 is one example). Routines themselves rely on Claude Code obeying the prose, which is best-effort.
- [`pre-market.md#L33-L38`](.claude/commands/pre-market.md#L33) — claims grep-first dedup for Perplexity. **G2** says wrong.

### 7.7 Generated cloud routines (`routines/`)

- Round-trip parity verified by running `bash scripts/build-routines.sh` — git status shows no uncommitted diff against the source. **Round-trip clean.**
- [`routines/_cloud-header.md`](routines/_cloud-header.md) — proper "no .env in cloud" guardrail. ENV-VAR section explains namespaced creds. Per-bot fan-out preamble lives here so all 10 routines inherit it.
- [`routines/README.md`](routines/README.md) — verify it now mentions the 10 routines (was 7 in prior audit's read of README.md).

### 7.8 Memory layout (`memory/`)

- Migration confirmed: `memory/live/default/`, `memory/paper/default/`, `memory/shared/` all exist with the right files.
- `memory/shared/dashboard-settings.json` is the single source of truth for the bot registry — `bots.sh` reads it, dashboard reads it.
- `memory/shared/DASHBOARD-AUDIT.jsonl` is new (audit log of dashboard-side actions). Append-only — verify rotation if it grows.
- `memory/<bot>/<strategy>/RUN-LOG.jsonl` is the per-bot heartbeat — but G1 means custom bots never get their own file.
- No paper bot files modified yet (paper/default/* shows initial seed). Expected.

### 7.9 Top-level docs

- [`README.md`](README.md) — **STALE**: says "Seven cron routines" (now 10), "memory/TRADING-STRATEGY.md" link is broken (now `memory/live/default/TRADING-STRATEGY.md`). Repo-layout section omits `dashboard/`. The local-quickstart section lists the routines but is missing late-morning, mid-morning, afternoon. **Severity: Medium** — first-time setup confusion.
- [`FLOW.md`](FLOW.md) — **STALE**: mermaid diagram has 7 routines; needs late-morning, mid-morning, afternoon. Memory boxes also use flat layout; should show per-bot/shared split. **Severity: Medium**.
- [`SUMMARY.md`](SUMMARY.md) — not read in this audit; verify.
- [`DAILY-SUMMARY.md`](DAILY-SUMMARY.md) — fallback file referenced by `discord.sh:25`. Existence-only check.
- [`env.template`](env.template) — references legacy `ALPACA_API_KEY` / `ALPACA_PAPER_API_KEY` only. **Missing**: namespaced `ALPACA_<NS>_API_KEY` template lines that the multi-account world needs. Add a comment block: "For each registered account in /bots, also set ALPACA_<NS>_API_KEY etc — the dashboard's BotsManager shows the exact var names."
- [`CLAUDE.md`](CLAUDE.md) — covers all 22 rules + per-bot memory layout. Comprehensive. Good reference doc.

### 7.10 Deployment (`scripts/launchd/`, log rotation, cron locking)

- 3 plists: `com.bullstocktrader.cloud-sync.plist` (15 min), `com.bullstocktrader.log-rotate.plist` (daily 02:00), `com.bullstocktrader.price-monitor.plist` (10 min). All have install/uninstall comment blocks at the top. Good DX.
- Hardcoded paths: every plist embeds `/Users/dietz/Desktop/Apps/bull-stock-trader/...`. Acceptable for single-machine dev install but not portable. If anyone else clones the repo, the install command will fail silently. Consider a `bash scripts/install-launchd.sh` that templates these from `$REPO_ROOT`. Effort: **Small**.
- All plists set `RunAtLoad=false` — appropriate (don't fire at boot; wait for next interval).
- No plist for the dashboard itself (Next.js dev server). Intentional? If users are expected to keep `pnpm dev` open in a tab, that's fine, but if `npm run start` is supposed to be a daemon, missing.
- Log paths under `~/Library/Logs/bull-stock-trader-*.log` — rotation at 02:00 trims to 1000 lines. Implements **rule #22**.
- Commit serialization (rule #21) implemented in [cron-sync.sh:31-36](scripts/cron-sync.sh#L31) via mkdir lock. **Rule #21 satisfied.**

---

## 8. Actionable Next Steps

### Wave 1 — Critical (~1-2 days)
1. **Fix G1**: `_lib.sh memory_dir_for()` → key off `BOT_ID` first, fallback to `BOT_MODE`. Audit downstream callers: `run-log.sh`, `price-monitor.sh`. Verify routines export `BOT_ID` (they do — confirmed in fan-out preambles).
2. **Fix G2**: Add grep-first idempotency to `scripts/perplexity.sh` keyed by `$(date +%Y-%m-%d) + sha256(query)`. Cache the response body in an adjacent `.perplexity-cache.jsonl` so subsequent calls return the cached answer.
3. **Fix G3**: `scripts/sync-cloud-memory.sh` — replace `BOTS=(live paper)` with a jq read of `memory/shared/dashboard-settings.json`'s bot ids.
4. **Fix G4**: `scripts/auth-preflight.sh` — emit `run-log.sh start <routine>` before doing the alpaca check, so a fail produces a matched start/end pair.
5. **Fix G5**: `scripts/price-monitor.sh` — wrap body in `bots.sh list` fan-out, per-bot state files.

### Wave 2 — High-leverage (~1-2 days)
6. F11 launchd-status tile in `/bots`.
7. F7/F8 — wire alert-watcher's `drawdown-breaker` + `rule-violation` cases (or hide the toggles).
8. P4 — alpaca.sh `orders` subcommand: accept `--after=<iso>`.
9. README + FLOW.md doc refresh (10 routines, multi-bot, per-bot/shared memory layout). Update env.template with namespaced cred examples.
10. F10 — `bash scripts/build-routines.sh && git diff --exit-code` as a `pre-push` hook.

### Wave 3 — Architecture (~3-5 days)
11. A1 — extract `_resolve_bot_id` helper to `_lib.sh`; document precedence.
12. A6 — extract routine fan-out preamble to `scripts/_routine-header.sh`, source from each routine.
13. A7 — write `docs/multi-bot-contract.md`.
14. A8 — `_curl_retry` 429-aware with `Retry-After`.
15. P1 — quarterly `claude/*` orphan-branch cleanup helper.
16. A11 — verify `seedFromEnv` slug handling.

### Wave 4 — Net-new features
17. F2 — auto-rotate vault key.
18. F3 — per-routine bot exclusion.
19. F6 — per-bot category Discord filters.
20. F9 — promotion rollback log.
21. F12 — hard-cap account allocation toggle.

### Wave 5 — Polish
22. U1 — Glance page banners.
23. U5 — AllocationBar overflow visualization.
24. U6 — `/bots/compare` permalink.
25. U10 — ForceExitBanner on `/trades`.
26. U11 — Nav "needs attention" badge.
27. A10 — fix two CT violations.

---

## 9. Appendix: Delta vs. 2026-05-02 audit

| Prior ID | Status | Note |
|---|---|---|
| C1 (live tiles ignore bot binding) | RESOLVED | PnlHero, MarketClock, LivePositions, PositionManagementTile, OrderEntryTile, useAccountSummary all thread `accountId` from `useTradingAccount()`. |
| C2 (`alpacaApiUrl(undefined)` downgrades) | RESOLVED | `alpacaApiUrl()` now returns `null` when neither mode nor accountId is set; SWR skips. |
| C3 (backtest hardcodes `bot = mode`) | RESOLVED | `/api/backtest/run` uses `resolveBotCtx`; runner takes `{mode, bot, strategy}`. Optional `strategyBot` provenance for cross-bot. |
| C4 (webhook category schema missing 3) | RESOLVED | `stops`, `auth-canary`, `alert` all in `webhookCategoryFiltersSchema` and `isWebhookCategory()`. |
| C5 (useStrategyState no `?account=`) | RESOLVED | Reads `botId` from `useTradingAccountOptional()`, builds `?bot=` query. |
| A1 (eliminate AlpacaMode below badge) | PARTIAL | Many sites migrated; `AlpacaMode` still appears as the `account` prop on tiles for back-compat. `lib/resolveAccount.ts` introduced `BotId`. |
| A2 (`mode.ts` legacy probes) | STILL OPEN | `detectAccountInfo`/`detectAccountInfoById` not unified yet. |
| A3 (server-side strategy-state cache) | STILL OPEN | No fingerprint cache visible in route. |
| A4 (rename `?account=` → `?bot=`) | RESOLVED | `?bot=` is canonical; `?account=` accepted as one-release shim ([resolveAccount.ts:31-32](dashboard/lib/resolveAccount.ts#L31)). |
| A5 (extract `resolveOrderIdentity`) | RESOLVED | Lives in `lib/resolveAccount.ts:123-163`. |
| A6 (`watch.ts` registry-aware) | RESOLVED | `loadKnownBots()` + classify uses the bot registry. |
| A7 (`seedFromEnv` collision risk) | LIKELY RESOLVED | `memoryAlias` field added to `botSchema`; `resolveBotCtx` honors it. Spot-check seedFromEnv to confirm it uses `legacy-live`/`legacy-paper`. |
| A8 (allocation referential integrity) | STILL OPEN | `assertReferentialIntegrity` only checks dup ids + missing FKs; allocation overrun still warning-only. |
| A9 (creds in both env slots) | STILL OPEN | `runAlpaca` cred-injection unchanged; one defensive change at `tradingAccountContext.tsx:182-186` re live default. |
| A10 (EARNINGS-CALENDAR per-bot scoping) | STILL OPEN | `memoryPath.ts:67` still per-bot. |
| F1 (cross-bot Overview compare) | RESOLVED | `/bots/compare` page exists. |
| F2 (cross-bot leaderboard) | RESOLVED | `BotsLeaderboard.tsx` + `/api/bots/leaderboard`. |
| F3 (allocation slider preview) | PARTIAL | `AllocationBar.tsx` exists; verify "what-if" preview when adding a bot. |
| F4 (Promote-to-live workflow) | RESOLVED | `PromoteModal.tsx` + `/api/bots/promote`. |
| F5 (vault key health banner) | RESOLVED | `VaultKeyBanner.tsx`. |
| F6 (per-bot routine status grid) | RESOLVED in code, BLOCKED by G1 | `CrossBotRoutineGrid.tsx` exists but renders bad data until G1 fixed. |
| F7 (sandbox sentinel) | RESOLVED | `sentinel`, `sentinelTrips` fields in `botSchema`. |
| F8 (cross-bot backtest) | PARTIAL | `strategyBot` provenance added; full "replay live trades through paper rules" requires per-bot strategy params. |
| F9 (strategy diff view) | RESOLVED | `/strategy?compare=` + `StrategyCompareView.tsx`. |
| F10 (per-bot Discord webhook) | RESOLVED | `bot.discordWebhookUrl` field. |
| U1 (AccountSelector grouping) | UNKNOWN | Not spot-checked in this audit. |
| U2 (settings doc / link to /bots) | UNKNOWN | Not spot-checked in this audit. |
| U3-U11 | MOSTLY UNCHECKED | Carry forward. |
| P1 (loadStrategyState cache) | STILL OPEN | See A3. |
| P2 (getBotPositions 500 orders) | PARTIAL | Now caches per-account (TTL=25s), still no `--after` filter on the alpaca side. |
| P3 (Backtest engine progress) | STILL OPEN | `/api/backtest/run` returns single response; no SSE progress streaming. |
| P4 (LiveRefresh debounce) | RESOLVED | `watch.ts` has 500ms debounce. |
| P5 (TradingAccountProvider double-fetch) | RESOLVED | Reads `bots`/`accounts` from `SettingsProvider`. |
| P6 (mascot hysteresis remount) | UNKNOWN | Not spot-checked. |
| P7 (grid layout sync localStorage) | UNKNOWN | Not spot-checked. |
| P8 (multiple `/clock` polls) | RESOLVED | `useMarketIsOpen` and `MarketClock` both go through `alpacaApiUrl` with the same key. |
| 7.1-7.19 | mostly RESOLVED or NEEDS-VERIFICATION; | see itemized findings above |
| 7.13 (brief getDay violation) | RESOLVED | No remaining `getDay()` in brief route. |

### New findings introduced in this audit (not in prior)

| ID | Severity | Summary |
|---|---|---|
| G1 | Critical | `_lib.sh memory_dir_for` keys off `BOT_MODE` not `BOT_ID`. |
| G2 | Critical | `perplexity.sh` lacks idempotency despite docs claiming it. |
| G3 | Critical | `sync-cloud-memory.sh` hardcodes BOTS=(live paper). |
| G4 | High | `auth-preflight` end-fail without matching start. |
| G5 | High | `price-monitor.sh` is single-bot in multi-bot world. |
| F1-F12 | various | New feature opportunities post-multi-bot. |
| A1-A11 | various | Architecture cleanup post-multi-bot. |
| U1-U11 | various | UX polish post-multi-bot. |
| P1-P7 | various | Performance issues post-multi-bot. |

---

## 10. Findings count

| Severity | Count |
|---|---|
| Critical | 3 |
| High | 5 |
| Medium | 14 |
| Low | 19 |

**Critical (3):** G1 (BOT_MODE memory routing), G2 (perplexity no-idempotency), G3 (sync-cloud-memory hardcoded BOTS).

**High (5):** G4 (auth-preflight run-log mismatch), G5 (price-monitor single-bot), A1, A6, P4. Plus the carry-forward "still-open" set from prior: A3, A8, F7.

**Medium (14):** README/FLOW staleness, A2, A8, A9, A10, A11, P1, P3, P7, F2, F3, F8, F11, F12, U5/U10/U11.

**Low (19):** Polish — U1-U4, U6-U9, A4-A5 cleanup tail, A7, P2, P5, P6, F1/F4-F6/F9-F10, build-routines CI gate.
