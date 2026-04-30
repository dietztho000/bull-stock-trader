FINAL STEP — COMMIT AND PUSH (if any memory files changed):
  git add memory/TRADE-LOG.md memory/RESEARCH-LOG.md memory/SECTOR-LEDGER.md
  git commit -m "midday scan $DATE"
  git push origin main
Skip commit if no-op. On push failure: git pull --rebase origin main, then push again.
Never force-push.
