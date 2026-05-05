## MANDATORY — FINAL STEP (run after the per-bot fan-out loop completes)

Emits the routine-completed heartbeat to every enabled bot's
RUN-LOG.jsonl, then commits + pushes every per-bot and shared write
captured during the loop in a single batch.

```bash
_routine_emit_end {{ROUTINE}} ok
git add memory/
if git diff --cached --quiet; then
  echo "no memory changes to commit"
else
  git commit -m "{{ROUTINE}} $DATE ($(bash scripts/bots.sh count) bots)"
  git push origin main
fi
```

**On push failure** (rule #21): retry up to 3 times —
`git pull --rebase origin main && git push origin main`, sleeping ~3s
between attempts. If still failing after 3 tries, send one Discord
--type=error post and exit non-zero. Never force-push.
