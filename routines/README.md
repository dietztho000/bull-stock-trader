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
3. **Set environment variables on the routine** (see [env.template](../env.template)
   for the full annotated list). At minimum:
   - `ALPACA_API_KEY`, `ALPACA_SECRET_KEY` (required)
   - `PERPLEXITY_API_KEY` (required for research)
   - `DISCORD_WEBHOOK_URL` (notifications)

   Optional:
   - `ALPACA_ENDPOINT`, `ALPACA_DATA_ENDPOINT` (defaults to live URLs)
   - `PERPLEXITY_MODEL` (defaults to `sonar`)
   - `BOT_MODE=paper` + `ALPACA_PAPER_*` (run a parallel paper routine)
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

## Paper-mode parallel routines

Strategy changes ship to paper first, run in parallel with live for ≥5
clean trading days, then promote to live. The pattern:

1. Duplicate any cloud routine you want to validate in paper mode.
   Suffix the name with ` (paper)` so it's distinguishable in the UI.
2. On the duplicate, set `BOT_MODE=paper` in env vars. Set the paper
   credentials (`ALPACA_PAPER_API_KEY`, `ALPACA_PAPER_SECRET_KEY`).
3. Use the same cron as the live version. Both fire at the same time
   from cloud. Each writes to memory under a separate
   `claude/paper-*` orphan branch so live + paper trade logs don't
   collide. (The cloud-sync launchd cherry-picks both into main.)
4. Watch the daily-summary watchdog confirm both fire. Compare paper
   vs live P&L for ≥5 days before promoting paper-only changes to live.

Slot budget: each paper duplicate counts against the 15/day Claude
Code routine quota. Stand up paper routines selectively — typically
the 3-4 routines a strategy change touches (e.g., market-open + the
4 intraday scans + stops). Tear down paper routines once a change
has graduated.

## Why no `.env` file in the cloud

The wrappers source `.env` if present, otherwise read from the process env.
A `.env` in the cloud would either leak secrets (if pushed) or be wasted work.
Each prompt contains a "do not create a .env file" block — re-paste verbatim
if you ever edit a prompt.
