#!/usr/bin/env bash
# Heartbeat run-log writer. Each routine calls this at start and end so
# memory/RUN-LOG.jsonl carries a structured trace of every cron run.
#
# Usage:
#   bash scripts/run-log.sh start <routine-name>
#   bash scripts/run-log.sh end   <routine-name> <status>   # status: ok|fail|noop
#
# The append is idempotent-friendly: each line gets a unique ISO timestamp,
# so a retried routine produces two lines (which is what we want — it tells
# us the routine fired twice). The EOD watchdog in daily-summary asserts
# every expected routine produced at least one "end ok" line today.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LOG="$ROOT/memory/RUN-LOG.jsonl"

action="${1:-}"
routine="${2:-}"
status="${3:-ok}"

if [[ -z "$action" || -z "$routine" ]]; then
  echo "usage: bash scripts/run-log.sh start|end <routine> [status]" >&2
  exit 1
fi

case "$action" in
  start|end) ;;
  *) echo "ERROR: action must be 'start' or 'end' (got '$action')" >&2; exit 1 ;;
esac

ts="$(date -u '+%Y-%m-%dT%H:%M:%SZ')"
sha="$(cd "$ROOT" && git rev-parse --short HEAD 2>/dev/null || echo unknown)"

if command -v jq >/dev/null 2>&1; then
  line="$(jq -nc \
    --arg ts "$ts" --arg r "$routine" --arg a "$action" \
    --arg s "$status" --arg sha "$sha" \
    '{ts:$ts, routine:$r, action:$a, status:$s, git_sha:$sha}')"
else
  # Fallback (no jq) — values are constrained by case/regex above.
  line="{\"ts\":\"$ts\",\"routine\":\"$routine\",\"action\":\"$action\",\"status\":\"$status\",\"git_sha\":\"$sha\"}"
fi

mkdir -p "$(dirname "$LOG")"
printf '%s\n' "$line" >> "$LOG"
echo "$line"
