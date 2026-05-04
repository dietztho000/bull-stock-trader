#!/usr/bin/env bash
# One-shot migration: flat memory/ -> per-bot memory/<bot>/<strategy>/ + memory/shared/.
#
# Idempotent. Safe to re-run. Refuses if both flat and nested copies of the
# same file exist with conflicting mtimes (operator must resolve manually).
#
# Usage:
#   bash scripts/migrate-memory-layout.sh [--dry-run] [--strategy <slug>]
#
# Defaults: strategy=default. The current flat layout is treated as live-bot
# state (the only bot that has been writing to memory/ until now). Paper is
# seeded with a copy of BENCHMARK + TRADING-STRATEGY (parsers need a
# phaseStart row + rulebook); other per-bot files start empty.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

STRATEGY=default
DRY_RUN=0
while (( $# > 0 )); do
  case "$1" in
    --dry-run) DRY_RUN=1; shift ;;
    --strategy) STRATEGY="${2:?--strategy needs a slug}"; shift 2 ;;
    -h|--help)
      sed -n '2,15p' "$0"; exit 0 ;;
    *) echo "ERROR: unknown arg '$1'" >&2; exit 1 ;;
  esac
done

LIVE_DIR="memory/live/$STRATEGY"
PAPER_DIR="memory/paper/$STRATEGY"
SHARED_DIR="memory/shared"

PER_BOT_FILES=(
  TRADING-STRATEGY.md
  TRADE-LOG.md
  RUN-LOG.jsonl
  BENCHMARK.md
  RESEARCH-LOG.md
  SECTOR-LEDGER.md
  WEEKLY-REVIEW.md
  EARNINGS-CALENDAR.md
  BACKTEST-RESULTS.md
  BACKTEST-RESULTS.json
)

# Files copied (not just moved) into paper so the parsers don't choke on
# missing inputs. BENCHMARK without a phaseStart breaks loadBenchmark math;
# TRADING-STRATEGY is the rulebook paper-fork experiments start from.
PAPER_SEED_COPY=(
  TRADING-STRATEGY.md
  BENCHMARK.md
)

SHARED_FILES=(
  SECTOR-MAP.md
  ECONOMIC-CALENDAR.md
  MARKET-EARNINGS.md
  PERPLEXITY-LOG.md
  DASHBOARD-AUDIT.jsonl
  dashboard-settings.json
)

# Runtime files that are gitignored — move them but do not seed paper.
RUNTIME_FILES=(
  .price-monitor-state.json
  .price-monitor.log
)

run() {
  if (( DRY_RUN )); then
    printf '  DRY: %s\n' "$*"
  else
    "$@"
  fi
}

is_tracked() {
  git ls-files --error-unmatch "$1" >/dev/null 2>&1
}

git_or_plain_mv() {
  local src="$1" dst="$2"
  if is_tracked "$src"; then
    run git mv "$src" "$dst"
  else
    run mv "$src" "$dst"
  fi
}

mtime_of() {
  # POSIX-portable mtime in seconds — fall back to date if stat differs.
  if stat -f '%m' "$1" >/dev/null 2>&1; then
    stat -f '%m' "$1"
  else
    stat -c '%Y' "$1"
  fi
}

# -- Pre-flight checks ------------------------------------------------------

echo "Migration target: live=$LIVE_DIR  paper=$PAPER_DIR  shared=$SHARED_DIR"
(( DRY_RUN )) && echo "(dry-run mode — no changes will be written)"
echo

# Refuse on conflicting copies (flat + nested both exist with different mtimes).
conflicts=0
for f in "${PER_BOT_FILES[@]}"; do
  flat="memory/$f"
  nested="$LIVE_DIR/$f"
  if [[ -f "$flat" && -f "$nested" ]]; then
    if [[ "$(mtime_of "$flat")" != "$(mtime_of "$nested")" ]]; then
      printf 'CONFLICT: %s and %s both exist with different mtimes.\n' \
        "$flat" "$nested" >&2
      conflicts=$((conflicts + 1))
    fi
  fi
done
for f in "${SHARED_FILES[@]}"; do
  flat="memory/$f"
  nested="$SHARED_DIR/$f"
  if [[ -f "$flat" && -f "$nested" ]]; then
    if [[ "$(mtime_of "$flat")" != "$(mtime_of "$nested")" ]]; then
      printf 'CONFLICT: %s and %s both exist with different mtimes.\n' \
        "$flat" "$nested" >&2
      conflicts=$((conflicts + 1))
    fi
  fi
done
if (( conflicts > 0 )); then
  echo >&2
  echo "Resolve conflicts manually (pick the canonical copy and delete the other) then re-run." >&2
  exit 2
fi

# -- Create dirs ------------------------------------------------------------

run mkdir -p "$LIVE_DIR" "$PAPER_DIR" "$SHARED_DIR"

# -- Move per-bot files: flat -> live -------------------------------------

moved=0
for f in "${PER_BOT_FILES[@]}"; do
  flat="memory/$f"
  nested="$LIVE_DIR/$f"
  if [[ ! -f "$flat" ]]; then
    if [[ -f "$nested" ]]; then
      printf '  %-30s already migrated -> %s\n' "$f" "$nested"
    else
      printf '  %-30s skipped (no source)\n' "$f"
    fi
    continue
  fi
  if [[ -f "$nested" ]]; then
    # Mtimes match (ruled out conflicts above). Drop the flat copy.
    printf '  %-30s nested copy exists, removing flat duplicate\n' "$f"
    if is_tracked "$flat"; then
      run git rm -q "$flat"
    else
      run rm "$flat"
    fi
    continue
  fi
  printf '  %-30s -> %s\n' "$f" "$nested"
  git_or_plain_mv "$flat" "$nested"
  moved=$((moved + 1))
done

# -- Seed paper from live (copy where parsers need non-empty input) -------

echo
for f in "${PAPER_SEED_COPY[@]}"; do
  src="$LIVE_DIR/$f"
  dst="$PAPER_DIR/$f"
  if [[ ! -f "$src" ]]; then
    printf '  paper seed: %-22s skipped (live source missing)\n' "$f"
    continue
  fi
  if [[ -f "$dst" ]]; then
    printf '  paper seed: %-22s already exists\n' "$f"
    continue
  fi
  printf '  paper seed: %-22s <- copy of %s\n' "$f" "$src"
  run cp "$src" "$dst"
done

# Empty-template files for the rest. The parsers all handle empty input
# gracefully (they short-circuit on empty content), so we just `touch` here.
echo
for f in "${PER_BOT_FILES[@]}"; do
  case " ${PAPER_SEED_COPY[*]} " in
    *" $f "*) continue ;;
  esac
  dst="$PAPER_DIR/$f"
  [[ -f "$dst" ]] && continue
  printf '  paper init: %-22s <- empty\n' "$f"
  run touch "$dst"
done

# -- Move shared files: flat -> shared ------------------------------------

echo
for f in "${SHARED_FILES[@]}"; do
  flat="memory/$f"
  nested="$SHARED_DIR/$f"
  if [[ ! -f "$flat" ]]; then
    if [[ -f "$nested" ]]; then
      printf '  shared:     %-22s already migrated\n' "$f"
    else
      printf '  shared:     %-22s skipped (no source)\n' "$f"
    fi
    continue
  fi
  if [[ -f "$nested" ]]; then
    printf '  shared:     %-22s nested exists, removing flat duplicate\n' "$f"
    if is_tracked "$flat"; then
      run git rm -q "$flat"
    else
      run rm "$flat"
    fi
    continue
  fi
  printf '  shared:     %-22s -> %s\n' "$f" "$nested"
  git_or_plain_mv "$flat" "$nested"
  moved=$((moved + 1))
done

# -- Move runtime/gitignored files (live only — paper has no local runner) -

echo
for f in "${RUNTIME_FILES[@]}"; do
  flat="memory/$f"
  nested="$LIVE_DIR/$f"
  if [[ ! -f "$flat" ]]; then
    continue
  fi
  if [[ -f "$nested" ]]; then
    printf '  runtime:    %-22s nested exists, removing flat duplicate\n' "$f"
    run rm "$flat"
    continue
  fi
  printf '  runtime:    %-22s -> %s\n' "$f" "$nested"
  run mv "$flat" "$nested"
done

echo
if (( moved == 0 )) && (( DRY_RUN == 0 )); then
  echo "Nothing to migrate — layout is already in the new shape."
  exit 0
fi

if (( DRY_RUN )); then
  echo "Dry-run complete. Re-run without --dry-run to apply."
  exit 0
fi

echo "Migrated $moved file(s). Review the working tree:"
echo
git status --short -- memory/ | head -40
echo
echo "Next steps:"
echo "  git diff --cached -- memory/   # inspect staged moves"
echo "  bash scripts/build-routines.sh # ensure routines are up to date"
echo "  pnpm --dir dashboard typecheck # confirm dashboard still compiles"
echo "  git commit -m \"migrate memory/ to per-bot layout\""
