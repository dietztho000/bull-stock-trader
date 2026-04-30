FINAL STEP — log heartbeat end + COMMIT AND PUSH (mandatory):
  bash scripts/run-log.sh end {{ROUTINE}} ok
  git add memory/WEEKLY-REVIEW.md memory/TRADING-STRATEGY.md memory/BENCHMARK.md memory/RUN-LOG.jsonl memory/PERPLEXITY-LOG.md
  git commit -m "weekly review $DATE"
  git push origin main
If TRADING-STRATEGY.md didn't change, git add will skip it silently.
On push failure: git pull --rebase origin main, then push again.
Never force-push.
