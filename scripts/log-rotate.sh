#!/usr/bin/env bash
# log-rotate.sh — daily truncation of bull-stock-trader launchd logs.
#
# Why: cron-sync.sh and price-monitor.sh both fire on launchd schedules
# (every 15 min and 10 min respectively). Their stdout/stderr land in
# ~/Library/Logs/bull-stock-trader-*.{out,err}.log and grow unbounded.
# This script keeps each file capped at the last 1000 lines.
#
# Invoked daily by scripts/launchd/com.bullstocktrader.log-rotate.plist
# at 02:00 local time (well before the 03:30 auth-canary).

set -euo pipefail

LOG_DIR="$HOME/Library/Logs"
KEEP_LINES=1000

shopt -s nullglob
for log in "$LOG_DIR"/bull-stock-trader-*.log; do
  # Skip if file is already small enough.
  cur=$(wc -l < "$log" 2>/dev/null || echo 0)
  if (( cur <= KEEP_LINES )); then
    continue
  fi
  tmp="$(mktemp "${log}.XXXXXX")"
  tail -n "$KEEP_LINES" "$log" > "$tmp"
  mv "$tmp" "$log"
  printf '[%s] log-rotate: trimmed %s from %d -> %d lines\n' \
    "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" \
    "$(basename "$log")" "$cur" "$KEEP_LINES"
done
