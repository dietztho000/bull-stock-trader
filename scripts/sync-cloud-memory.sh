#!/usr/bin/env bash
# Backfill memory/* writes from cloud-routine branches into local main.
#
# Cloud routines are supposed to push to main (FINAL STEP in each routine),
# but when "Allow unrestricted branch pushes" is OFF in the routine env,
# the push lands on a per-run claude/* branch instead. Result: the
# dashboard reads main and sees an empty memory/ dir.
#
# Per-bot layout: each (bot, strategy, file) tuple is checked independently.
# A live-bot routine and a paper-bot routine push to separate branches
# touching memory/<bot>/<strategy>/<file>; we cherry-pick each per file
# rather than per branch so live + paper writes from different branches
# can both land.
#
# Usage: bash scripts/sync-cloud-memory.sh

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# Bot tuples come from the registry — each row is "<memory-dir>\t<strategy>".
# memoryAlias wins over the bot id so seeded legacy bots (id=legacy-live,
# memoryAlias=live) keep reading from memory/live/. include-disabled because
# disabled bots may still receive scheduled cloud-routine writes mid-disable.
BOT_TUPLES=()
if [[ -f memory/shared/dashboard-settings.json ]] && command -v jq >/dev/null 2>&1; then
  while IFS= read -r row; do
    [[ -n "$row" ]] && BOT_TUPLES+=("$row")
  done < <(jq -r '.bots[]? | "\((.memoryAlias // .id))\t\((.strategySlug // "default"))"' \
    memory/shared/dashboard-settings.json 2>/dev/null | sort -u)
fi
# Legacy fallback: pre-registry installs and bare repos still need to sync.
if [[ ${#BOT_TUPLES[@]} -eq 0 ]]; then
  BOT_TUPLES=($'live\tdefault' $'paper\tdefault')
fi

PER_BOT_FILES=(
  RESEARCH-LOG.md
  TRADE-LOG.md
  BENCHMARK.md
  RUN-LOG.jsonl
  SECTOR-LEDGER.md
  WEEKLY-REVIEW.md
  EARNINGS-CALENDAR.md
)

SHARED_FILES=(
  PERPLEXITY-LOG.md
  SECTOR-MAP.md
  ECONOMIC-CALENDAR.md
  MARKET-EARNINGS.md
)

# -- Safety guards ----------------------------------------------------------

current_branch="$(git symbolic-ref --short HEAD 2>/dev/null || echo "")"
if [[ "$current_branch" != "main" ]]; then
  echo "ERROR: current branch is '$current_branch', expected 'main'." >&2
  echo "Switch to main before running this script." >&2
  exit 1
fi

if ! git diff --quiet -- memory/ || ! git diff --cached --quiet -- memory/; then
  echo "ERROR: working tree has uncommitted changes under memory/." >&2
  echo "Commit or stash them before running this script." >&2
  git status --short -- memory/ >&2
  exit 1
fi

# -- Fetch latest cloud branches --------------------------------------------

echo "Fetching origin…"
git fetch --quiet origin '+refs/heads/claude/*:refs/remotes/origin/claude/*'

# -- Helpers ----------------------------------------------------------------

# Echo "1" if the branch's diff vs its merge-base with origin/main contains
# any path outside memory/, else "0".
_branch_touches_non_memory() {
  local ref="$1"
  local base
  base="$(git merge-base "$ref" origin/main 2>/dev/null || true)"
  [[ -z "$base" ]] && { echo 1; return; }
  if git diff --name-only "$base..$ref" | grep -qv '^memory/'; then
    echo 1
  else
    echo 0
  fi
}

# Find the newest origin/claude/* ref that (a) touches the given exact
# memory path AND (b) touches only memory/* paths overall. Prints
# "<ref>|<iso-date>" or nothing if no candidate exists.
_newest_writer_for_path() {
  local target_path="$1"
  while IFS='|' read -r date ref; do
    [[ -z "$ref" ]] && continue
    local base diff_files
    base="$(git merge-base "$ref" origin/main 2>/dev/null || true)"
    [[ -z "$base" ]] && continue
    diff_files="$(git diff --name-only "$base..$ref")"
    grep -qx "$target_path" <<<"$diff_files" || continue
    grep -qv '^memory/' <<<"$diff_files" && continue
    printf '%s|%s\n' "$ref" "$date"
    return 0
  done < <(git for-each-ref --sort=-committerdate refs/remotes/origin/claude/ \
            --format='%(committerdate:iso-strict)|%(refname:short)')
}

_pick_one() {
  local label="$1" path="$2"
  local result ref date
  result="$(_newest_writer_for_path "$path" || true)"
  if [[ -z "$result" ]]; then
    printf '  %-44s — no cloud writer found, leaving as-is\n' "$label"
    return 1
  fi
  ref="${result%%|*}"
  date="${result##*|}"
  if [[ "$(_branch_touches_non_memory "$ref")" == "1" ]]; then
    printf '  %-44s ⚠️  newest writer (%s) touches non-memory paths — skipped\n' "$label" "$ref"
    return 1
  fi
  git checkout "$ref" -- "$path"
  printf '  %-44s ← %s (%s)\n' "$label" "$ref" "$date"
  return 0
}

# -- Main loop --------------------------------------------------------------

echo
echo "Looking for cloud-side memory writes…"
echo

picked=0

for tuple in "${BOT_TUPLES[@]}"; do
  IFS=$'\t' read -r bot strategy <<<"$tuple"
  for f in "${PER_BOT_FILES[@]}"; do
    label="$bot/$strategy/$f"
    path="memory/$bot/$strategy/$f"
    if _pick_one "$label" "$path"; then
      picked=$((picked + 1))
    fi
  done
done

for f in "${SHARED_FILES[@]}"; do
  label="shared/$f"
  path="memory/shared/$f"
  if _pick_one "$label" "$path"; then
    picked=$((picked + 1))
  fi
done

echo
if [[ "$picked" -eq 0 ]]; then
  echo "Nothing to backfill — local main is already up to date."
  exit 0
fi

# -- Report -----------------------------------------------------------------

echo "Staged $picked file(s). Review and commit:"
echo
git diff --cached --stat -- memory/
echo
echo "Next:"
echo "  git diff --cached -- memory/   # inspect"
echo "  git commit -m \"backfill cloud-routine memory writes for \$(date +%Y-%m-%d)\""
