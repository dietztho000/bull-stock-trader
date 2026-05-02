FINAL STEP — log heartbeat end + COMMIT AND PUSH (mandatory if any trades
executed OR if the STEP 1 inline-research fallback wrote a fresh
RESEARCH-LOG.md entry):
  bash scripts/run-log.sh end {{ROUTINE}} ok
  git add memory/TRADE-LOG.md memory/SECTOR-LEDGER.md memory/RESEARCH-LOG.md memory/RUN-LOG.jsonl memory/PERPLEXITY-LOG.md
  git commit -m "market-open $DATE"
  git push origin main
Always commit at least RUN-LOG.jsonl + PERPLEXITY-LOG.md (even on no-op runs)
so the heartbeat trace and call log persist across the fresh-clone routines.
On push failure (rule #21): retry up to 3 times — `git pull --rebase
origin main && git push origin main`, sleeping ~3s between attempts.
If still failing after 3 tries, exit with an error Discord post;
never force-push.
