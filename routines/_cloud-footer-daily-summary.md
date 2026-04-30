FINAL STEP — log heartbeat end + COMMIT AND PUSH (mandatory — tomorrow's
Day P&L depends on this commit landing):
  bash scripts/run-log.sh end {{ROUTINE}} ok
  git add memory/TRADE-LOG.md memory/BENCHMARK.md memory/RUN-LOG.jsonl memory/PERPLEXITY-LOG.md
  git commit -m "EOD snapshot $DATE"
  git push origin main
On push failure: git pull --rebase origin main, then push again.
Never force-push.
