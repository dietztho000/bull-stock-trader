FINAL STEP — COMMIT AND PUSH (only if TRADE-LOG was updated):
  git add memory/TRADE-LOG.md
  git commit -m "stop reconciliation $DATE"
  git push origin main
Skip commit if no stops were modified. On push failure: git pull --rebase origin main, then push again.
Never force-push.
