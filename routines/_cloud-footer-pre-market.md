FINAL STEP — log heartbeat end + COMMIT AND PUSH (mandatory):
  bash scripts/run-log.sh end {{ROUTINE}} ok
  git add memory/RESEARCH-LOG.md memory/RUN-LOG.jsonl memory/PERPLEXITY-LOG.md
  git commit -m "pre-market research $DATE"
  git push origin main
On push failure: git pull --rebase origin main, then push again.
Never force-push.
