#!/usr/bin/env bash
# Backfill memory/* writes from cloud-routine branches into local main.
#
# Cloud routines are supposed to push to main (FINAL STEP in each routine),
# but when "Allow unrestricted branch pushes" is OFF in the routine env,
# the push lands on a per-run claude/* branch instead. Result: the
# dashboard reads main and sees an empty memory/ dir.
#
# This script picks, per memory file, the newest claude/* branch that
# touched it AND that touches ONLY memory/* (skips outlier branches that
# also modified scripts or commands). It checks each file out into the
# working tree (which also stages it) and stops — leaves the user to
# review the diff and commit.
#
# Usage: bash scripts/sync-cloud-memory.sh

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

MEMORY_FILES=(
  RESEARCH-LOG.md
  TRADE-LOG.md
  BENCHMARK.md
  PERPLEXITY-LOG.md
  RUN-LOG.jsonl
  SECTOR-LEDGER.md
  SECTOR-MAP.md
  WEEKLY-REVIEW.md
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

# Find the newest origin/claude/* ref that (a) touches memory/<file> AND
# (b) touches only memory/* paths overall. Prints "<ref>|<iso-date>" or
# nothing if no candidate exists.
_newest_writer_for() {
  local file="$1"
  while IFS='|' read -r date ref; do
    [[ -z "$ref" ]] && continue
    local base diff_files
    base="$(git merge-base "$ref" origin/main 2>/dev/null || true)"
    [[ -z "$base" ]] && continue
    diff_files="$(git diff --name-only "$base..$ref")"
    grep -qx "memory/$file" <<<"$diff_files" || continue
    grep -qv '^memory/' <<<"$diff_files" && continue
    printf '%s|%s\n' "$ref" "$date"
    return 0
  done < <(git for-each-ref --sort=-committerdate refs/remotes/origin/claude/ \
            --format='%(committerdate:iso-strict)|%(refname:short)')
}

# -- Main loop --------------------------------------------------------------

echo
echo "Looking for cloud-side memory writes…"
echo

picked=0
for f in "${MEMORY_FILES[@]}"; do
  result="$(_newest_writer_for "$f" || true)"
  if [[ -z "$result" ]]; then
    printf '  %-20s — no cloud writer found, leaving as-is\n' "$f"
    continue
  fi
  ref="${result%%|*}"
  date="${result##*|}"
  # If this branch is the newest writer but it ALSO touches non-memory files,
  # warn instead of pulling — the per-file _newest_writer_for already filters
  # those out, but defense-in-depth in case the data shape changes.
  if [[ "$(_branch_touches_non_memory "$ref")" == "1" ]]; then
    printf '  %-20s ⚠️  newest writer (%s) touches non-memory paths — skipped\n' "$f" "$ref"
    continue
  fi
  git checkout "$ref" -- "memory/$f"
  printf '  %-20s ← %s (%s)\n' "$f" "$ref" "$date"
  picked=$((picked + 1))
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
