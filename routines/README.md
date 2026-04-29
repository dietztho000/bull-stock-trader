# Cloud Routines

Each `.md` file in this directory is the prompt body for a Claude Code cloud
routine. Paste the file contents **verbatim** into the routine's prompt field —
do not paraphrase. The env-var check block and the COMMIT AND PUSH step are
load-bearing.

## Schedule (America/Chicago)

| Routine        | Cron          | When                                |
|----------------|---------------|-------------------------------------|
| pre-market     | `0 6 * * 1-5` | 6:00 AM weekdays                    |
| market-open    | `30 8 * * 1-5`| 8:30 AM weekdays (market opens)     |
| midday         | `0 12 * * 1-5`| Noon weekdays                       |
| daily-summary  | `0 15 * * 1-5`| 3:00 PM weekdays (market closes CT) |
| weekly-review  | `0 16 * * 5`  | 4:00 PM Fridays only                |

## One-time prerequisites

1. **Install the Claude GitHub App** on this repo (least privilege — single repo).
2. **Toggle "Allow unrestricted branch pushes"** in each routine's environment.
   Without this, `git push origin main` silently fails with a proxy error.
3. **Set environment variables on the routine** (NOT in a `.env` file in the repo):
   - `ALPACA_API_KEY`, `ALPACA_SECRET_KEY` (required)
   - `ALPACA_ENDPOINT`, `ALPACA_DATA_ENDPOINT` (optional, defaults to live URLs)
   - `PERPLEXITY_API_KEY` (required for research)
   - `PERPLEXITY_MODEL` (optional, defaults to `sonar`)
   - `DISCORD_WEBHOOK_URL` (notifications — Discord server settings → Integrations → Webhooks)

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
