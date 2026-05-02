FINAL STEP — log heartbeat end + COMMIT AND PUSH:
  bash scripts/run-log.sh end {{ROUTINE}} ok
  git add memory/TRADE-LOG.md memory/RUN-LOG.jsonl memory/PERPLEXITY-LOG.md
  git commit -m "auth-canary $DATE"
  git push origin main
Always commit at least RUN-LOG.jsonl (even on a passing run) so the EOD
watchdog can see the canary fired. On push failure (rule #21): retry up
to 3 times — `git pull --rebase origin main && git push origin main`,
sleeping ~3s between attempts. If still failing after 3 tries, exit
with an error Discord post; never force-push.
