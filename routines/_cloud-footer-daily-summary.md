FINAL STEP — COMMIT AND PUSH (mandatory — tomorrow's Day P&L depends on this):
  git add memory/TRADE-LOG.md memory/BENCHMARK.md
  git commit -m "EOD snapshot $DATE"
  git push origin main
On push failure: git pull --rebase origin main, then push again.
Never force-push.
