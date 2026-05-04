FINAL STEP — log heartbeat end + COMMIT AND PUSH (runs ONCE after the
per-bot loop completes — captures every bot's writes in a single commit):
  _routine_emit_end {{ROUTINE}} ok
  # `memory/` includes every per-bot subdir touched in the loop plus the
  # shared writes (PERPLEXITY-LOG, calendars, sector cache, audit log).
  git add memory/
  if git diff --cached --quiet; then
    echo "no memory changes to commit"
  else
    git commit -m "{{ROUTINE}} $DATE ($(bash scripts/bots.sh count) bots)"
    git push origin main
  fi
On push failure (rule #21): retry up to 3 times — `git pull --rebase
origin main && git push origin main`, sleeping ~3s between attempts.
If still failing after 3 tries, exit with an error Discord post;
never force-push.
