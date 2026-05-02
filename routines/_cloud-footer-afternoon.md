FINAL STEP — log heartbeat end + COMMIT AND PUSH:
  bash scripts/run-log.sh end {{ROUTINE}} ok
  git add memory/TRADE-LOG.md memory/RESEARCH-LOG.md memory/SECTOR-LEDGER.md memory/RUN-LOG.jsonl memory/PERPLEXITY-LOG.md
  git commit -m "afternoon scan $DATE"
  git push origin main
Always commit at least RUN-LOG.jsonl + PERPLEXITY-LOG.md (even on no-op runs)
so the heartbeat trace persists. On push failure (rule #21): retry up to 3 times — `git pull --rebase
origin main && git push origin main`, sleeping ~3s between attempts.
If still failing after 3 tries, exit with an error Discord post;
never force-push.
