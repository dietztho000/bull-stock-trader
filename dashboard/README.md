# Bull Stock Trader — Dashboard

Local-only Next.js dashboard for the bull-stock-trader bot. Reads markdown
memory files from `../memory/` and pulls live state from Alpaca via
`../scripts/alpaca.sh`.

## Run

```bash
pnpm install
pnpm dev
```

Open http://localhost:3000.

The dashboard auto-refreshes when any file in `../memory/*.md` changes
(SSE + chokidar). Live Alpaca panels poll every 5s via SWR.

## Notes

- Mostly read-only. Two write paths exist:
  - `/calendar` "Refresh economic events" → writes to `../memory/ECONOMIC-CALENDAR.md`
  - `/settings` save → writes to `../memory/dashboard-settings.json` (gitignored)
  No writes to Alpaca.
- Honors `BOT_MODE=live|paper` from `../.env`.
- No auth, no DB. Re-parses markdown on every request.

## Pages

- `/` Overview — KPIs, equity-vs-SPY chart, account panel, latest research,
  upcoming-events strip, **Pre-Market Discord Brief** button.
- `/calendar` — month grid + agenda list of upcoming earnings (cached in
  `../memory/EARNINGS-CALENDAR.md`) and economic events
  (`../memory/ECONOMIC-CALENDAR.md`, refreshable via Perplexity).
- `/settings` — per-machine dashboard preferences (Discord webhook
  overrides, ntfy topic). Stored in `../memory/dashboard-settings.json`.
