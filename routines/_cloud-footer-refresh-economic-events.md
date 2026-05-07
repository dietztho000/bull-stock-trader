## MANDATORY — FINAL STEP

Emits the routine-completed heartbeat (the daily-summary watchdog reads
RUN-LOG.jsonl to verify all expected routines fired), then commits +
pushes the shared write.

```bash
_routine_emit_end {{ROUTINE}} ok
git add memory/
if git diff --cached --quiet; then
  echo "no memory changes to commit"
else
  git commit -m "{{ROUTINE}} $DATE"
  git push origin main
fi
```

**On push failure** (rule #21): retry up to 3 times —
`git pull --rebase origin main && git push origin main`, sleeping ~3s
between attempts. If still failing after 3 tries, send one Discord
--type=error post and exit non-zero. Never force-push.
