#!/usr/bin/env bash
# price-monitor.sh — non-trading early-warning poller.
#
# Polls Alpaca positions, posts a Discord warning the first time a position
# drops into each -1% bucket at or below -5% (so the user sees -5%, then -6%,
# then -7%, etc — never spammed at the same level twice). Doesn't trade.
#
# Run on a launchd interval (every 600s during market hours via the
# StartCalendarInterval entries in scripts/launchd/com.bullstocktrader.price-monitor.plist).
#
# Gates:
#   - alpaca.sh clock reports is_open=false  -> exit silently
#   - State file's date != today              -> reset buckets (new trading day)
#
# State file:  memory/.price-monitor-state.json (gitignored)
#   { "date": "YYYY-MM-DD", "buckets": { "SYM": -7, ... } }

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck source=_lib.sh
source "$ROOT/scripts/_lib.sh"
_load_env "$ROOT"
_require_jq

STATE_FILE="$ROOT/memory/.price-monitor-state.json"
TODAY="$(date +%Y-%m-%d)"

# Gate: market open?
clock_json="$(bash "$ROOT/scripts/alpaca.sh" clock 2>/dev/null || true)"
is_open="$(printf '%s' "$clock_json" | jq -r '.is_open // false' 2>/dev/null || echo false)"
if [[ "$is_open" != "true" ]]; then
  exit 0
fi

# Load or initialize state. Reset on a new trading day so yesterday's warned
# positions warn again today if still underwater.
if [[ -f "$STATE_FILE" ]]; then
  state_date="$(jq -r '.date // ""' "$STATE_FILE" 2>/dev/null || echo "")"
  if [[ "$state_date" != "$TODAY" ]]; then
    printf '{"date":"%s","buckets":{}}' "$TODAY" > "$STATE_FILE"
  fi
else
  printf '{"date":"%s","buckets":{}}' "$TODAY" > "$STATE_FILE"
fi

# Pull positions.
positions_json="$(bash "$ROOT/scripts/alpaca.sh" positions 2>/dev/null || echo "[]")"

# Iterate. For each position with unrealized_plpc <= -0.05, compute the
# bucket as floor(plpc * 100) — i.e., -0.054 -> -5, -0.061 -> -7 (wait, no:
# -0.061 * 100 = -6.1, floor = -7). Bucket worsens as it gets more negative.
# Only post a warning when the bucket is strictly more negative than the
# last-warned bucket for that symbol.

# shellcheck disable=SC2155
declare -A new_buckets

# jq emits one TSV row per position: SYM<TAB>plpc<TAB>entry<TAB>current
while IFS=$'\t' read -r sym plpc entry current; do
  [[ -z "$sym" ]] && continue
  # bucket = floor(plpc * 100). awk handles the float math + flooring.
  bucket="$(awk -v p="$plpc" 'BEGIN{ printf "%d", (p*100 < int(p*100) ? int(p*100)-1 : int(p*100)) }')"
  # Only care about buckets at or below -5.
  if (( bucket > -5 )); then
    continue
  fi
  last="$(jq -r --arg s "$sym" '.buckets[$s] // 0' "$STATE_FILE")"
  # Worsening means more negative (smaller integer).
  if (( bucket < last )); then
    pct="$(awk -v p="$plpc" 'BEGIN{ printf "%.2f", p*100 }')"
    msg="$(printf '⚠️ %s at %s%% (entry $%s → now $%s) — bucket %d, approaching -7%% exchange stop' \
            "$sym" "$pct" "$entry" "$current" "$bucket")"
    # --type=alert: routed to ntfy.sh (when NTFY_TOPIC set) instead of
    # Discord, keeping high-frequency warnings off the webhook rate limit.
    bash "$ROOT/scripts/discord.sh" --type=alert "$msg" >/dev/null 2>&1 || true
    new_buckets["$sym"]="$bucket"
  else
    # Preserve the existing (worse-or-equal) bucket so we don't lose it.
    new_buckets["$sym"]="$last"
  fi
done < <(printf '%s' "$positions_json" | jq -r '
  if type == "array" then
    .[] | [.symbol, (.unrealized_plpc | tonumber), .avg_entry_price, .current_price] | @tsv
  else
    empty
  end' 2>/dev/null || true)

# Persist updated buckets. Build a new state JSON from the new_buckets map,
# preserving any symbols that had a recorded bucket but no longer have a
# matching entry in this iteration (they may have closed — drop them).
{
  printf '{"date":"%s","buckets":{' "$TODAY"
  first=1
  for sym in "${!new_buckets[@]}"; do
    [[ $first -eq 1 ]] || printf ','
    printf '"%s":%d' "$sym" "${new_buckets[$sym]}"
    first=0
  done
  printf '}}'
} > "$STATE_FILE.tmp" && mv "$STATE_FILE.tmp" "$STATE_FILE"
