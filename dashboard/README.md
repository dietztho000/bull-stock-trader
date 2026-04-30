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

- Read-only. No writes to memory or Alpaca.
- Honors `BOT_MODE=live|paper` from `../.env`.
- No auth, no DB. Re-parses markdown on every request.
