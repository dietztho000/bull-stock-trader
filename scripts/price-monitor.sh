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
# Multi-bot fan-out: when memory/shared/dashboard-settings.json has enabled
# bots, this script iterates each bot and polls its account independently —
# state per bot at memory/<bot>/<strategy>/.price-monitor-state.json. When
# the registry is empty, falls back to the legacy single-account run using
# BOT_MODE env (preserves pre-registry installs).
#
# Gates (per bot):
#   - alpaca.sh clock reports is_open=false  -> exit silently
#   - State file's date != today              -> reset buckets (new trading day)
#
# State file:  memory/<bot>/<strategy>/.price-monitor-state.json (gitignored)
#   { "date": "YYYY-MM-DD", "buckets": { "SYM": -7, ... } }
#
# Bash 3.2 compatible: launchd invokes /bin/bash explicitly (macOS ships 3.2),
# so no associative arrays, no mapfile — state mutation lives in jq.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck source=_lib.sh
source "$ROOT/scripts/_lib.sh"
_load_env "$ROOT"
_require_jq

TODAY="$(date +%Y-%m-%d)"

# Gate the whole run on market-open once — Alpaca's clock is account-agnostic
# so polling it N times for N bots wastes API budget.
clock_json="$(bash "$ROOT/scripts/alpaca.sh" clock 2>/dev/null || true)"
is_open="$(printf '%s' "$clock_json" | jq -r '.is_open // false' 2>/dev/null || echo false)"
if [[ "$is_open" != "true" ]]; then
  exit 0
fi

# Per-bot poller. Threading account/bot through alpaca.sh ensures the right
# credential set is picked up; per-bot STATE_FILE means -5%/-6%/-7% buckets
# don't bleed across bots that share an account.
monitor_one() {
  local bot_id="$1" account_id="$2" strategy="$3"
  local alpaca_args=()
  if [[ -n "$bot_id" ]]; then
    export BOT_ID="$bot_id" STRATEGY="$strategy"
    alpaca_args=(--account-id="$account_id" --bot-id="$bot_id")
  else
    # Legacy single-bot mode: rely on BOT_MODE env (memory_dir_for honors it
    # when BOT_ID is unset).
    unset BOT_ID
  fi

  local STATE_DIR STATE_FILE
  STATE_DIR="$(memory_dir_for "$ROOT")"
  STATE_FILE="$STATE_DIR/.price-monitor-state.json"
  mkdir -p "$STATE_DIR"

  if [[ -f "$STATE_FILE" ]]; then
    local state_date
    state_date="$(jq -r '.date // ""' "$STATE_FILE" 2>/dev/null || echo "")"
    if [[ "$state_date" != "$TODAY" ]]; then
      printf '{"date":"%s","buckets":{}}' "$TODAY" > "$STATE_FILE"
    fi
  else
    printf '{"date":"%s","buckets":{}}' "$TODAY" > "$STATE_FILE"
  fi

  local positions_json
  positions_json="$(bash "$ROOT/scripts/alpaca.sh" "${alpaca_args[@]}" positions 2>/dev/null || echo "[]")"

  # 1) Compute newly-worsened positions (TSV: sym\tplpc_pct\tentry\tcurrent\tbucket).
  #    A "newly worsened" position is one whose current bucket is <= -5 AND
  #    strictly more negative than the bot's last-warned bucket for that symbol.
  local worsened
  worsened="$(printf '%s' "$positions_json" | jq -r --slurpfile s "$STATE_FILE" '
    def bucket(plpc): (plpc * 100 | floor);
    ($s[0].buckets // {}) as $cur
    | (. // [])[]?
    | (.unrealized_plpc | tonumber) as $plpc
    | bucket($plpc) as $b
    | ($cur[.symbol] // 0) as $last
    | select($b <= -5 and $b < $last)
    | [.symbol, ($plpc * 100), .avg_entry_price, .current_price, $b] | @tsv
  ' 2>/dev/null || true)"

  # 2) Fire one --type=alert per newly-worsened position. Label the message
  #    with the bot id when fan-out is active so the user can tell at a
  #    glance which bot is bleeding.
  if [[ -n "$worsened" ]]; then
    local sym pct entry current bucket label msg
    label="${bot_id:+[${bot_id}] }"
    while IFS=$'\t' read -r sym pct entry current bucket; do
      [[ -z "$sym" ]] && continue
      msg="$(printf '⚠️ %s%s at %.2f%% (entry $%s → now $%s) — bucket %d, approaching -7%% exchange stop' \
              "$label" "$sym" "$pct" "$entry" "$current" "$bucket")"
      bash "$ROOT/scripts/discord.sh" --type=alert "$msg" >/dev/null 2>&1 || true
    done <<<"$worsened"
  fi

  # 3) Rebuild state from positions in THIS iteration. Closed positions and
  #    those that rallied back above -5% drop out (matches prior behavior).
  local new_state
  new_state="$(printf '%s' "$positions_json" | jq --slurpfile s "$STATE_FILE" --arg today "$TODAY" '
    def bucket(plpc): (plpc * 100 | floor);
    ($s[0].buckets // {}) as $cur
    | { date: $today,
        buckets: (
          reduce (. // [])[]? as $p ({};
            ($p.unrealized_plpc | tonumber) as $plpc
            | bucket($plpc) as $b
            | ($cur[$p.symbol] // 0) as $last
            | if $b <= -5 then
                .[$p.symbol] = (if $b < $last then $b else $last end)
              else
                .
              end
          )
        )
      }
  ')"
  printf '%s' "$new_state" > "$STATE_FILE.tmp" && mv "$STATE_FILE.tmp" "$STATE_FILE"
}

# Discover bots. An empty registry yields a single synthetic row so the
# legacy launchd plist (which only sets BOT_MODE) still produces one run.
BOT_ROWS=()
while IFS= read -r row; do
  BOT_ROWS+=("$row")
done < <(bash "$ROOT/scripts/bots.sh" list 2>/dev/null || true)
if [[ ${#BOT_ROWS[@]} -eq 0 ]]; then
  BOT_ROWS=($'\t\t\t\t')
fi

for row in "${BOT_ROWS[@]}"; do
  IFS=$'\t' read -r bot_id account_id strategy _allocation _mode <<<"$row"
  monitor_one "$bot_id" "$account_id" "${strategy:-default}"
done
