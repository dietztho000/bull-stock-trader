#!/usr/bin/env bash
# Periodic cloud-routine memory sync. Designed to be invoked by launchd
# (see scripts/launchd/com.bullstocktrader.cloud-sync.plist).
#
# Flow:
#   1. auto-commit any DIRTY memory/      — local writers (smoke tests,
#                                           browser writes, cache appends)
#                                           land first so the pull + sync
#                                           steps see a clean working tree
#   2. git pull --rebase --autostash      — pick up cloud-side pushes to
#                                           main; --autostash is defense in
#                                           depth against any race between
#                                           step 1 and the rebase
#   3. scripts/sync-cloud-memory.sh       — pull memory writes from any
#                                           orphan claude/* branches (this
#                                           script refuses dirty memory/,
#                                           hence step 1's pre-commit)
#   4. auto-commit any staged memory/*    — keeps the loop idempotent
#
# Refuses to run if there are uncommitted changes OUTSIDE memory/ — that
# almost always means the user is mid-edit on the dashboard or a script,
# and we don't want to surprise them. Memory/ writes are fine — step 1's
# pre-pull commit makes the rest of the flow's clean-tree expectations
# hold.
#
# Best-effort: each step logs and exits on its own failure; we never fall
# through to commit something we didn't expect.

set -uo pipefail   # deliberately NOT -e

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT" || exit 1

ts() { date -u '+%Y-%m-%dT%H:%M:%SZ'; }
log() { printf '[%s] cron-sync: %s\n' "$(ts)" "$*"; }

# Status file consumed by the dashboard's MemoryFreshness pill so it can
# distinguish "the pull is broken" from "pulls succeed but no routine wrote
# anything". Both launchd and the dashboard's manual-sync API spawn this
# script, so this is the single source of truth for last-pull-time.
# CRON_SYNC_TRIGGER lets the API route stamp `manual` instead of `launchd`.
STATUS_FILE="$ROOT/.cron-sync-status.json"
TRIGGER="${CRON_SYNC_TRIGGER:-launchd}"
STARTED_AT="$(ts)"

# Escape backslashes and double quotes for safe embedding in a JSON string.
json_escape() { printf '%s' "$1" | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g'; }

write_status() {
  local exit_code="$1" message="$2" finished_at
  finished_at="$(ts)"
  printf '{"startedAt":"%s","finishedAt":"%s","exitCode":%s,"trigger":"%s","message":"%s"}\n' \
    "$STARTED_AT" "$finished_at" "$exit_code" "$TRIGGER" "$(json_escape "$message")" \
    > "$STATUS_FILE.tmp" \
    && mv "$STATUS_FILE.tmp" "$STATUS_FILE"
}

# Write a "running" marker (no finishedAt yet) so the dashboard can show an
# in-flight indicator if it polls during a long pull.
printf '{"startedAt":"%s","finishedAt":null,"exitCode":null,"trigger":"%s","message":"running"}\n' \
  "$STARTED_AT" "$TRIGGER" > "$STATUS_FILE.tmp" && mv "$STATUS_FILE.tmp" "$STATUS_FILE"

# Serialize against any concurrent local commit/push (rule #21).
# Non-blocking: if another process holds the lock, exit silently — the
# next 15-min tick will catch up. Avoids piling up jobs behind a stuck
# git operation. Uses mkdir as the atomic primitive (portable across
# macOS/Linux; flock is Linux-only and not present in macOS base).
LOCK_DIR="$ROOT/.git/.commit-lock.d"
if ! mkdir "$LOCK_DIR" 2>/dev/null; then
  log "another git op holds .commit-lock — skipping this tick"
  write_status 0 "skipped: another git op holds the commit lock"
  exit 0
fi
trap 'rmdir "$LOCK_DIR" 2>/dev/null || true' EXIT

log "starting"

branch="$(git symbolic-ref --short HEAD 2>/dev/null || echo "")"
if [[ "$branch" != "main" ]]; then
  log "ERROR: not on main (currently '$branch') — skipping"
  write_status 1 "not on main (currently '$branch')"
  exit 1
fi

if ! git diff --quiet -- . ':!memory/' || ! git diff --cached --quiet -- . ':!memory/'; then
  log "uncommitted changes outside memory/ — skipping (finish other work first)"
  write_status 0 "skipped: uncommitted changes outside memory/"
  exit 0
fi

# Auto-commit any dirty memory/ from local writers (smoke tests, browser-
# side dashboard writes, perplexity.sh cache appends) BEFORE the pull. The
# pull's --autostash would carry these across the rebase, but the next
# step (sync-cloud-memory.sh) refuses to run with dirty memory/ because
# its cherry-pick logic isn't safe alongside unstaged changes. Committing
# here keeps the working tree clean for the rest of the flow.
if ! git diff --quiet -- memory/ || ! git diff --cached --quiet -- memory/; then
  log "auto-committing local memory/ writes pre-pull"
  if ! git add -- memory/ || ! git commit -m "auto-commit local memory writes for $(TZ=America/Chicago date +%Y-%m-%d)"; then
    log "ERROR: pre-pull memory commit failed — aborting"
    write_status 1 "pre-pull memory commit failed"
    exit 1
  fi
fi

log "git pull --rebase --autostash origin main"
if ! git pull --rebase --autostash origin main; then
  log "ERROR: pull failed (rebase conflict?) — aborting"
  write_status 1 "git pull failed (rebase conflict or network)"
  exit 1
fi

log "running scripts/sync-cloud-memory.sh"
if ! bash scripts/sync-cloud-memory.sh; then
  log "ERROR: sync script failed"
  write_status 1 "sync-cloud-memory.sh failed"
  exit 1
fi

if ! git diff --cached --quiet -- memory/; then
  msg="auto-sync cloud-routine memory writes for $(date +%Y-%m-%d)"
  log "committing: $msg"
  if ! git commit -m "$msg"; then
    log "ERROR: commit failed — leaving staged for manual inspection"
    write_status 1 "commit failed — staged changes left for manual inspection"
    exit 1
  fi
else
  log "nothing new to commit"
fi

log "done"
write_status 0 "done"
