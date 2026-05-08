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
  DAILY-SUMMARY.md
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

# Dispatch on file extension.
#
# - .jsonl: line-union by .ts (RUN-LOG.jsonl etc.). Each row is a complete
#   JSON object; semantic boundary is the line. Bug fixed 2026-05-06.
#
# - .md: 3-way merge of every writer's branch into HEAD's tree via
#   `git merge-tree`. Bug fixed 2026-05-07: REPLACE silently dropped
#   disjoint sections when two cloud routines pushed to separate claude/*
#   branches off the same origin/main snapshot in the same trading day
#   (hit on 2026-05-07: pre-market RESEARCH-LOG section vanished because
#   midday-addendum's writer branched before pre-market pushed). Writers
#   are grep-first idempotent within a single execution, but that doesn't
#   protect against parallel writers; the 3-way merge does.
#
# - other (no extension match): REPLACE fallback for any file we haven't
#   classified yet. Dirty branches still gated through the safety check.
_pick_one() {
  local label="$1" path="$2"
  case "$path" in
    *.jsonl) _pick_one_union "$label" "$path" ;;
    *.md)    _pick_one_3way_merge "$label" "$path" ;;
    *)       _pick_one_replace "$label" "$path" ;;
  esac
}

_pick_one_replace() {
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

# Union-merge mode: collect every memory-only claude/* branch that
# touched $path, concatenate with the local file, dedupe by full line
# (each JSONL row is a deterministic complete object), and sort by .ts.
# Each individual writer is gated through the same non-memory safety
# check as _pick_one_replace — a dirty branch is excluded from the
# union, not the entire path.
_pick_one_union() {
  local label="$1" path="$2"
  local writers=() ref base diff_files
  while IFS= read -r ref; do
    [[ -z "$ref" ]] && continue
    base="$(git merge-base "$ref" origin/main 2>/dev/null || true)"
    [[ -z "$base" ]] && continue
    diff_files="$(git diff --name-only "$base..$ref" 2>/dev/null)"
    grep -qx "$path" <<<"$diff_files" || continue
    grep -qv '^memory/' <<<"$diff_files" && continue
    writers+=("$ref")
  done < <(git for-each-ref --sort=-committerdate refs/remotes/origin/claude/ \
            --format='%(refname:short)')

  if [[ ${#writers[@]} -eq 0 ]]; then
    printf '  %-44s — no cloud writer found, leaving as-is\n' "$label"
    return 1
  fi

  local tmp merged
  tmp="$(mktemp)"
  [[ -f "$path" ]] && cat "$path" >> "$tmp"
  for ref in "${writers[@]}"; do
    git show "$ref:$path" 2>/dev/null >> "$tmp" || true
  done
  merged="$(grep -v '^[[:space:]]*$' "$tmp" | sort -u \
            | jq -s 'sort_by(.ts) | .[]' -c 2>/dev/null || true)"
  rm -f "$tmp"

  if [[ -z "$merged" ]]; then
    printf '  %-44s — empty union, leaving as-is\n' "$label"
    return 1
  fi

  # Skip staging when the merged content matches the local file —
  # avoids gratuitous "no-op" backfill commits when cloud branches
  # only repeat rows already in local.
  if [[ -f "$path" ]] && diff -q <(printf '%s\n' "$merged") "$path" >/dev/null 2>&1; then
    printf '  %-44s = already up to date (%d branch(es) checked)\n' "$label" "${#writers[@]}"
    return 1
  fi

  printf '%s\n' "$merged" > "$path.tmp" && mv "$path.tmp" "$path"
  git add -- "$path"
  printf '  %-44s ⊕ %d branch(es) union-merged\n' "$label" "${#writers[@]}"
  return 0
}

# 3-way merge mode: iteratively merge every memory-only claude/* writer
# that touched $path into HEAD's tree using `git merge-tree`. Writers
# are processed oldest-first by committerdate so the resulting file
# preserves chronological section order (pre-market before midday before
# eod, etc.). On any merge conflict — which means two writers touched
# the same section with different content — abort and surface for human
# review rather than silently dropping data.
#
# Why merge-tree (Git 2.38+): performs the 3-way merge entirely in the
# object DB without touching the working tree, returns the merged tree
# OID directly. We can chain calls (each iteration's output feeds the
# next) and only write the final blob to the working tree at the end.
_pick_one_3way_merge() {
  local label="$1" path="$2"
  local writers=() ref base diff_files
  while IFS= read -r ref; do
    [[ -z "$ref" ]] && continue
    base="$(git merge-base "$ref" origin/main 2>/dev/null || true)"
    [[ -z "$base" ]] && continue
    diff_files="$(git diff --name-only "$base..$ref" 2>/dev/null)"
    grep -qx "$path" <<<"$diff_files" || continue
    grep -qv '^memory/' <<<"$diff_files" && continue
    writers+=("$ref")
  done < <(git for-each-ref --sort=committerdate refs/remotes/origin/claude/ \
            --format='%(refname:short)')

  if [[ ${#writers[@]} -eq 0 ]]; then
    printf '  %-44s — no cloud writer found, leaving as-is\n' "$label"
    return 1
  fi

  # Single writer is equivalent to checkout-replace: skip the merge
  # machinery, but route through the same dirty-branch guard.
  if [[ ${#writers[@]} -eq 1 ]]; then
    ref="${writers[0]}"
    if [[ "$(_branch_touches_non_memory "$ref")" == "1" ]]; then
      printf '  %-44s ⚠️  newest writer (%s) touches non-memory paths — skipped\n' "$label" "$ref"
      return 1
    fi
    git checkout "$ref" -- "$path"
    local writer_date
    writer_date="$(git log -1 --format='%ci' "$ref")"
    printf '  %-44s ← %s (%s)\n' "$label" "$ref" "$writer_date"
    return 0
  fi

  # Multi-writer: chain 3-way merges. current_tree starts at HEAD (which
  # is post-pull, so already has whatever main has). Each writer merges
  # into current_tree using its own merge-base with origin/main as the
  # 3-way base — that's the correct base for "what did this writer add
  # vs the snapshot it branched from."
  local current_tree merged_tree merge_status
  # Quoting silences SC1083 — the {tree} suffix is git's peel-to-tree
  # gitrevisions syntax, not bash brace expansion.
  current_tree="$(git rev-parse 'HEAD^{tree}')"

  for ref in "${writers[@]}"; do
    base="$(git merge-base "$ref" origin/main 2>/dev/null || true)"
    if [[ -z "$base" ]]; then
      printf '  %-44s ⚠️  no merge-base for %s — skipped\n' "$label" "$ref"
      return 1
    fi
    # `-X theirs` resolves conflicts by preferring the writer being
    # merged in (the "theirs" side). Combined with oldest-first ordering,
    # this means newer writers always win on overlapping sections —
    # exactly matching the OLD REPLACE semantics for that case — while
    # disjoint sections from earlier writers still get preserved.
    # Writers are grep-first idempotent, so a real cross-writer "this
    # section disagrees" conflict doesn't arise in practice; if it ever
    # does, the newer writer's version is the operationally-correct one.
    #
    # --write-tree writes the merged tree to the object DB and prints
    # its OID. With `-X theirs` the merge effectively cannot fail on
    # text conflict; we still guard the exit status for other failure
    # modes (binary conflict, invalid base, etc.).
    merged_tree="$(git merge-tree -X theirs --write-tree --merge-base="$base" \
                    "$current_tree" "$ref" 2>/dev/null)"
    merge_status=$?
    if [[ $merge_status -ne 0 ]] || [[ -z "$merged_tree" ]]; then
      printf '  %-44s ⚠️  unrecoverable merge error at %s — leaving as-is for manual review\n' "$label" "$ref"
      return 1
    fi
    current_tree="$merged_tree"
  done

  # Extract the merged blob for $path from the final tree.
  local blob_oid
  blob_oid="$(git ls-tree "$current_tree" -- "$path" 2>/dev/null | awk '{print $3}')"
  if [[ -z "$blob_oid" ]]; then
    printf '  %-44s ⚠️  merge result has no blob for path — skipped\n' "$label"
    return 1
  fi

  # No-op detection: skip staging if the merged content is byte-identical
  # to local. Avoids gratuitous "auto-sync" commits when cloud branches
  # only repeated content already in local.
  if [[ -f "$path" ]] && diff -q <(git cat-file blob "$blob_oid") "$path" >/dev/null 2>&1; then
    printf '  %-44s = already up to date (%d writer(s) merged)\n' "$label" "${#writers[@]}"
    return 1
  fi

  git cat-file blob "$blob_oid" > "$path.tmp" && mv "$path.tmp" "$path"
  git add -- "$path"
  printf '  %-44s ⊕ %d writer(s) 3-way merged\n' "$label" "${#writers[@]}"
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
