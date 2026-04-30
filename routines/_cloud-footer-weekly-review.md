FINAL STEP — COMMIT AND PUSH (mandatory):
  git add memory/WEEKLY-REVIEW.md memory/TRADING-STRATEGY.md memory/BENCHMARK.md
  git commit -m "weekly review $DATE"
  git push origin main
If TRADING-STRATEGY.md didn't change, git add will skip it silently.
On push failure: git pull --rebase origin main, then push again.
Never force-push.
