FINAL STEP — COMMIT AND PUSH (mandatory if any trades executed OR if the
STEP 1 inline-research fallback wrote a fresh RESEARCH-LOG.md entry):
  git add memory/TRADE-LOG.md memory/SECTOR-LEDGER.md memory/RESEARCH-LOG.md
  git commit -m "market-open $DATE"
  git push origin main
Skip commit if NEITHER trades fired NOR the fallback wrote a research entry.
On push failure: git pull --rebase origin main, then push again.
Never force-push.
