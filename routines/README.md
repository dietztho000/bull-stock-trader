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

| Routine        | Cron          | When                                       |
|----------------|---------------|--------------------------------------------|
| auth-canary    | `30 3 * * 1-5`| 3:30 AM weekdays — auth health pre-flight  |
| pre-market     | `0 6 * * 1-5` | 6:00 AM weekdays                           |
| market-open    | `30 8 * * 1-5`| 8:30 AM weekdays (market opens)            |
| midday         | `0 12 * * 1-5`| Noon weekdays                              |
| stops          | `30 13 * * 1-5`| 1:30 PM weekdays — stop reconciliation    |
| daily-summary  | `0 15 * * 1-5`| 3:00 PM weekdays (market closes CT)        |
| weekly-review  | `0 16 * * 5`  | 4:00 PM Fridays only                       |

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
     - `DISCORD_WEBHOOK_URL_EOD` on `daily-summary`
     - `DISCORD_WEBHOOK_URL_WEEKLY` on `weekly-review`
     - `DISCORD_WEBHOOK_URL_FILL` on `market-open` / `trade`
     - `DISCORD_WEBHOOK_URL_MIDDAY` on `midday`
     - `DISCORD_WEBHOOK_URL_STOPS` on `stops`
     - `DISCORD_WEBHOOK_URL_RESEARCH` on `pre-market`
     - `DISCORD_WEBHOOK_URL_ERROR` on any routine (auth-preflight failures)

## Creating a routine

1. Routines → New Routine.
2. Name it (e.g. "Trading bot pre-market").
3. Select this repository, branch `main`.
4. Add the env vars above.
5. Toggle on "Allow unrestricted branch pushes".
6. Set the cron + timezone.
7. Paste the matching `routines/<name>.md` contents into the prompt field.
8. Save, then click **Run now** to smoke-test.

## Why no `.env` file in the cloud

The wrappers source `.env` if present, otherwise read from the process env.
A `.env` in the cloud would either leak secrets (if pushed) or be wasted work.
Each prompt contains a "do not create a .env file" block — re-paste verbatim
if you ever edit a prompt.
