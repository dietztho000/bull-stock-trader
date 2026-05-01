#!/usr/bin/env bash
# Periodic cloud-routine memory sync. Designed to be invoked by launchd
# (see scripts/launchd/com.bullstocktrader.cloud-sync.plist).
#
# Flow:
#   1. git pull --rebase origin main      — pick up cloud-side pushes to main
#   2. scripts/sync-cloud-memory.sh       — pull memory writes from any
#                                           orphan claude/* branches
#   3. auto-commit any staged memory/*    — keeps the loop idempotent
#
# Refuses to run if there are uncommitted changes OUTSIDE memory/ — that
# almost always means the user is mid-edit on the dashboard or a script,
# and we don't want to surprise them.
#
# Best-effort: each step logs and exits on its own failure; we never fall
# through to commit something we didn't expect.

set -uo pipefail   # deliberately NOT -e

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT" || exit 1

ts() { date -u '+%Y-%m-%dT%H:%M:%SZ'; }
log() { printf '[%s] cron-sync: %s\n' "$(ts)" "$*"; }

log "starting"

branch="$(git symbolic-ref --short HEAD 2>/dev/null || echo "")"
if [[ "$branch" != "main" ]]; then
  log "ERROR: not on main (currently '$branch') — skipping"
  exit 1
fi

if ! git diff --quiet -- . ':!memory/' || ! git diff --cached --quiet -- . ':!memory/'; then
  log "uncommitted changes outside memory/ — skipping (finish other work first)"
  exit 0
fi

log "git pull --rebase origin main"
if ! git pull --rebase origin main; then
  log "ERROR: pull failed (rebase conflict?) — aborting"
  exit 1
fi

log "running scripts/sync-cloud-memory.sh"
if ! bash scripts/sync-cloud-memory.sh; then
  log "ERROR: sync script failed"
  exit 1
fi

if ! git diff --cached --quiet -- memory/; then
  msg="auto-sync cloud-routine memory writes for $(date +%Y-%m-%d)"
  log "committing: $msg"
  if ! git commit -m "$msg"; then
    log "ERROR: commit failed — leaving staged for manual inspection"
    exit 1
  fi
else
  log "nothing new to commit"
fi

log "done"
