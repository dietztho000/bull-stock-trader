#!/usr/bin/env bash
# cleanup-claude-branches.sh — prune stale `claude/*` orphan branches.
#
# When "Allow unrestricted branch pushes" is OFF in the routine env, cloud
# routines push memory writes to per-run `claude/<sha>` orphan branches
# instead of `main`. `cron-sync.sh` cherry-picks those writes back into
# main every 15 min. After ~6 months of operation, with 10 routines × N
# bots × M weeks, the orphan refs accumulate into thousands and slow down
# every `git fetch claude/*` (audit P1).
#
# This script deletes refs older than $MAX_AGE_DAYS (default 90) BOTH
# locally (`refs/remotes/origin/claude/*`) AND on the remote. Default is a
# dry run — pass --apply to actually delete.
#
# Usage:
#   bash scripts/cleanup-claude-branches.sh             # dry run
#   bash scripts/cleanup-claude-branches.sh --apply
#   MAX_AGE_DAYS=180 bash scripts/cleanup-claude-branches.sh --apply
#
# Schedule: run quarterly (or on-demand when fetch starts feeling slow).
# Safe to interleave with cron-sync.sh — they touch disjoint refs.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

MAX_AGE_DAYS="${MAX_AGE_DAYS:-90}"
APPLY=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --apply)        APPLY=true; shift ;;
    --max-age=*)    MAX_AGE_DAYS="${1#--max-age=}"; shift ;;
    -h|--help)
      sed -n '2,20p' "$0" | sed 's/^# \{0,1\}//'
      exit 0
      ;;
    *) echo "unknown flag: $1 (try --help)" >&2; exit 1 ;;
  esac
done

if ! [[ "$MAX_AGE_DAYS" =~ ^[0-9]+$ ]]; then
  echo "ERROR: MAX_AGE_DAYS must be an integer (got '$MAX_AGE_DAYS')" >&2
  exit 1
fi

# -- Safety: refuse to run on non-main branches so a partial checkout
#    can't accidentally rewrite refs the user is in the middle of using.
current_branch="$(git symbolic-ref --short HEAD 2>/dev/null || echo "")"
if [[ "$current_branch" != "main" ]]; then
  echo "ERROR: current branch is '$current_branch' — switch to main first" >&2
  exit 1
fi

# -- Refresh remote view so we don't keep refs that are already gone
#    upstream (they'd be a no-op delete; just noise).
echo "Fetching origin (with prune) …"
git fetch --quiet --prune origin '+refs/heads/claude/*:refs/remotes/origin/claude/*'

now_epoch="$(date -u '+%s')"
cutoff_epoch=$(( now_epoch - MAX_AGE_DAYS * 86400 ))

# -- Enumerate stale refs. Format: "<unix_ts> <ref_short_name>".
stale_refs=()
while IFS=' ' read -r ts ref; do
  [[ -z "$ts" || -z "$ref" ]] && continue
  if (( ts < cutoff_epoch )); then
    stale_refs+=("$ref")
  fi
done < <(git for-each-ref --format='%(committerdate:unix) %(refname:short)' \
          refs/remotes/origin/claude/)

if [[ ${#stale_refs[@]} -eq 0 ]]; then
  echo "Nothing to prune — no claude/* refs older than ${MAX_AGE_DAYS}d."
  exit 0
fi

printf "Stale claude/* refs (>%dd):  %d\n" "$MAX_AGE_DAYS" "${#stale_refs[@]}"
printf '  %s\n' "${stale_refs[@]}" | head -20
if [[ ${#stale_refs[@]} -gt 20 ]]; then
  printf '  … and %d more\n' "$(( ${#stale_refs[@]} - 20 ))"
fi

if ! $APPLY; then
  echo
  echo "Dry run — pass --apply to actually delete."
  exit 0
fi

# -- Delete on the remote in batches so the URL stays under git's CLI
#    limit. `git push origin --delete <ref>` accepts multiple refs.
echo
echo "Deleting on remote …"
remote_refs=()
for ref in "${stale_refs[@]}"; do
  # ref looks like "origin/claude/<sha>" — strip the "origin/" prefix.
  remote_refs+=(":${ref#origin/}")   # ":branch" syntax = delete on push
done

batch_size=50
total=${#remote_refs[@]}
i=0
while (( i < total )); do
  end=$(( i + batch_size ))
  (( end > total )) && end=$total
  git push --quiet origin "${remote_refs[@]:i:end-i}" || true
  i=$end
done

# -- Drop the local mirrors. Refresh-prune would catch them on next fetch
#    too, but doing it explicitly here gives an immediate `git branch -r`
#    cleanup signal.
echo "Pruning local mirror refs …"
for ref in "${stale_refs[@]}"; do
  git update-ref -d "refs/remotes/$ref"
done

echo "Done. Pruned ${#stale_refs[@]} ref(s) older than ${MAX_AGE_DAYS}d."
