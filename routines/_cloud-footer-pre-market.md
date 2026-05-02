FINAL STEP — log heartbeat end + COMMIT AND PUSH (mandatory):
  bash scripts/run-log.sh end {{ROUTINE}} ok
  git add memory/RESEARCH-LOG.md memory/EARNINGS-CALENDAR.md memory/RUN-LOG.jsonl memory/PERPLEXITY-LOG.md
  git commit -m "pre-market research $DATE"
  git push origin main
On push failure (rule #21): retry up to 3 times — `git pull --rebase
origin main && git push origin main`, sleeping ~3s between attempts.
If still failing after 3 tries, exit with an error Discord post;
never force-push.
