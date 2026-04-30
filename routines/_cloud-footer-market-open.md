FINAL STEP — COMMIT AND PUSH (mandatory if any trades executed):
  git add memory/TRADE-LOG.md memory/SECTOR-LEDGER.md
  git commit -m "market-open trades $DATE"
  git push origin main
Skip commit if no trades fired. On push failure: git pull --rebase origin main, then push again.
Never force-push.
