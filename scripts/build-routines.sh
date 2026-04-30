#!/usr/bin/env bash
# Regenerate routines/<name>.md from .claude/commands/<name>.md.
#
# Single-source-of-truth: STEP content lives ONLY in .claude/commands/<name>.md
# between <!-- STEPS-BEGIN --> and <!-- STEPS-END --> markers. The cloud
# routine = _cloud-header.md + extracted steps + _cloud-footer-<name>.md.
#
# Run this after editing any command file, then commit both files together.
# CI can verify in-sync state by running this and asserting `git diff --exit-code`.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CMD_DIR="$ROOT/.claude/commands"
ROUTINE_DIR="$ROOT/routines"

# Routines that have a cloud counterpart. /portfolio and /trade are
# interactive — local-only, no cloud routine.
ROUTINES=(pre-market market-open midday daily-summary weekly-review stops)

extract_steps() {
  # Print everything between the BEGIN/END markers (markers themselves stripped).
  awk '/<!-- STEPS-BEGIN -->/{flag=1; next} /<!-- STEPS-END -->/{flag=0} flag' "$1"
}

for name in "${ROUTINES[@]}"; do
  cmd="$CMD_DIR/$name.md"
  footer="$ROUTINE_DIR/_cloud-footer-$name.md"
  out="$ROUTINE_DIR/$name.md"
  [[ -f "$cmd"    ]] || { echo "missing $cmd"    >&2; exit 1; }
  [[ -f "$footer" ]] || { echo "missing $footer" >&2; exit 1; }

  steps="$(extract_steps "$cmd")"
  if [[ -z "${steps// /}" ]]; then
    echo "no steps marked in $cmd (need <!-- STEPS-BEGIN -->...<!-- STEPS-END -->)" >&2
    exit 1
  fi

  {
    echo "<!-- AUTO-GENERATED from .claude/commands/$name.md by scripts/build-routines.sh — do not edit directly. -->"
    echo
    cat "$ROUTINE_DIR/_cloud-header.md"
    echo
    printf '%s\n' "$steps"
    echo
    cat "$footer"
  } > "$out"

  echo "wrote $out"
done
