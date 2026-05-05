# Cloud Routines

Each `.md` file in this directory is the prompt body for a Claude Code cloud
routine. Paste the file contents **verbatim** into the routine's prompt field —
do not paraphrase. The env-var preflight block and the COMMIT AND PUSH step
are load-bearing.

## Single source of truth — do not edit routine files by hand

The STEP content of every routine lives in `.claude/commands/<name>.md`
between `<!-- STEPS-BEGIN -->` / `<!-- STEPS-END -->` markers. The matching
`routines/<name>.md` file is **auto-generated** by:

```bash
bash scripts/build-routines.sh
```

…which concatenates `_cloud-header.md` + the extracted steps + the
per-routine `_cloud-footer-<name>.md`. Edit the command file, run the build
script, commit both files together. CI can verify in-sync state with
`git diff --exit-code routines/`.

## Schedule (America/Chicago)

| Routine        | Cron           | When                                                |
|----------------|----------------|-----------------------------------------------------|
| auth-canary    | `30 3 * * 1-5` | 3:30 AM weekdays — auth health pre-flight           |
| pre-market     | `0 6 * * 1-5`  | 6:00 AM weekdays                                    |
| market-open    | `30 8 * * 1-5` | 8:30 AM weekdays (market opens)                     |
| mid-morning    | `0 10 * * 1-5` | 10:00 AM weekdays — promote stops, escalate buys    |
| late-morning   | `0 11 * * 1-5` | 11:00 AM weekdays — promote stops, thesis check     |
| midday         | `0 12 * * 1-5` | Noon weekdays — full intraday scan + Perplexity     |
| stops          | `30 13 * * 1-5`| 1:30 PM weekdays — stop reconciliation              |
| afternoon      | `0 14 * * 1-5` | 2:00 PM weekdays — promote stops, thesis check      |
| daily-summary  | `0 15 * * 1-5` | 3:00 PM weekdays (market closes CT)                 |
| weekly-review  | `0 16 * * 5`   | 4:00 PM Fridays only                                |

## One-time prerequisites

1. **Install the Claude GitHub App** on this repo (least privilege — single repo).
2. **Toggle "Allow unrestricted branch pushes"** in each routine's environment.
   Without this, `git push origin main` silently fails with a proxy error.
3. **Configure the bot registry** in the dashboard (Settings → Bots & accounts).
   Routines fan out across every enabled bot in
   `memory/shared/dashboard-settings.json` via `bash scripts/bots.sh list`. A
   single routine handles N bots in one run — see
   [docs/multi-bot-contract.md](../docs/multi-bot-contract.md) for the
   bot/account/strategy model.
4. **Set environment variables on the routine.** See [env.template](../env.template)
   for the full annotated list.

   **Per-account credentials (required, namespaced).** One credential set per
   Alpaca account, with the env-var prefix derived by uppercasing the
   `accountId` slug and replacing hyphens with underscores. So account
   `paper-100k` needs:
   - `ALPACA_PAPER_100K_API_KEY`
   - `ALPACA_PAPER_100K_SECRET_KEY`
   - `ALPACA_PAPER_100K_ENDPOINT` (optional — defaults by mode)

   Run `bash scripts/bots.sh env-namespace <accountId>` to print the prefix
   for any account. Wrapper scripts (`alpaca.sh` etc.) auto-resolve the
   right namespace from `--account-id=…`.

   **Shared external creds:**
   - `PERPLEXITY_API_KEY` (required for research)
   - `PERPLEXITY_MODEL` (optional, defaults to `sonar`)
   - `DISCORD_WEBHOOK_URL` (notifications)

   **Optional:**
   - `NTFY_TOPIC` (mirror Discord notifications to ntfy.sh)
   - Per-category Discord webhook overrides — set on the matching routine
     to send that category to a dedicated channel. Each falls back to
     `DISCORD_WEBHOOK_URL` when unset:
     - `DISCORD_WEBHOOK_URL_AUTH_CANARY` on `auth-canary`
     - `DISCORD_WEBHOOK_URL_EOD` on `daily-summary`
     - `DISCORD_WEBHOOK_URL_WEEKLY` on `weekly-review`
     - `DISCORD_WEBHOOK_URL_FILL` on `market-open` / `trade`
     - `DISCORD_WEBHOOK_URL_MIDDAY` on `midday`, `mid-morning`, `late-morning`,
       `afternoon` (the four intraday scans share one channel)
     - `DISCORD_WEBHOOK_URL_STOPS` on `stops`
     - `DISCORD_WEBHOOK_URL_RESEARCH` on `pre-market`
     - `DISCORD_WEBHOOK_URL_ERROR` on any routine (in-flight workflow failures
       — but `auth-canary`'s own preflight failures route to the auth-canary
       channel above, since that channel is the dedicated bot-health stream)

## Creating a routine

1. Routines → New Routine.
2. Name it (e.g. "Trading bot pre-market").
3. Select this repository, branch `main`.
4. Add the env vars above.
5. Toggle on "Allow unrestricted branch pushes".
6. Set the cron + timezone.
7. Paste the matching `routines/<name>.md` contents into the prompt field.
8. Save, then click **Run now** to smoke-test.

## Running paper alongside live

Strategy changes ship to paper first, run in parallel with live for ≥5
clean trading days, then promote to live. With the multi-bot rollout,
you do **not** duplicate routines — each routine fans out across every
enabled bot in the registry on a single run. The pattern:

1. In the dashboard's Settings → Bots & accounts, add a paper-mode
   account (e.g. `paper-100k`) and a bot bound to it (e.g. `momentum-paper`
   with strategy slug `momentum`). The registry persists in
   `memory/shared/dashboard-settings.json`.
2. On every cloud routine, set the namespaced creds for the new account
   (`ALPACA_PAPER_100K_API_KEY`, `ALPACA_PAPER_100K_SECRET_KEY`). The
   live account's namespace stays put.
3. No cron change. The next scheduled run picks up the new bot via
   `bash scripts/bots.sh list --routine=<name>` and writes to
   `memory/<botId>/<strategy>/…` for that bot. The cloud commits one
   per-routine batch covering every bot it touched.
4. The daily-summary watchdog reports `N/M routines fired` for the
   fleet. Compare paper vs live P&L row-by-row in
   `memory/<botId>/default/BENCHMARK.md` for ≥5 days, then promote
   strategy edits by copying `memory/<paperBot>/default/TRADING-STRATEGY.md`
   over the live equivalent.

Slot budget: every cloud routine still counts as one Claude Code routine
slot regardless of how many bots fan out under it. Adding a paper bot
to the registry is free in slot terms.

Routine-level opt-outs: `bot.routineFilter[<name>] = false` in the
registry skips that bot for that specific routine — useful if the paper
bot should not run, say, `weekly-review` because it has no full-week
window yet.

## Why no `.env` file in the cloud

The wrappers source `.env` if present, otherwise read from the process env.
A `.env` in the cloud would either leak secrets (if pushed) or be wasted work.
Each prompt contains a "do not create a .env file" block — re-paste verbatim
if you ever edit a prompt.
