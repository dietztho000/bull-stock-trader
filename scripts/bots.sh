#!/usr/bin/env bash
# Bot registry helper. Reads memory/shared/dashboard-settings.json (the
# single source of truth maintained by the dashboard) and emits the
# enabled bots in a TSV format that routines can iterate.
#
# Usage:
#   bash scripts/bots.sh list                  # tab-separated rows
#   bash scripts/bots.sh list --enabled-only   # default for routines
#   bash scripts/bots.sh list --include-disabled
#   bash scripts/bots.sh count                 # number of enabled bots
#   bash scripts/bots.sh env-namespace <slug>  # echoes the env var prefix
#                                                e.g. "PAPER_100K" for slug
#                                                "paper-100k"
#
# `list` row format (TAB-separated):
#   bot_id  account_id  strategy  allocation  mode
# Where `allocation` is "" if null (use full account) and `mode` is the
# account's mode ("live" | "paper").
#
# Example loop in a routine:
#   while IFS=$'\t' read -r bot_id account_id strategy allocation mode; do
#     export BOT_ID="$bot_id" ACCOUNT_ID="$account_id" STRATEGY="$strategy"
#     export BOT_ALLOCATION="$allocation"
#     # ... run steps ...
#   done < <(bash scripts/bots.sh list)
#
# Exits 0 even when the registry is empty so routines can no-op cleanly.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SETTINGS_FILE="$ROOT/memory/shared/dashboard-settings.json"

cmd="${1:-list}"
shift || true

case "$cmd" in
  list)
    # --enabled-only       (default) skip bots with enabled=false
    # --include-disabled   list every bot regardless of enabled
    # --routine=<name>     audit F3: also skip bots whose
    #                      bot.routineFilter[name] is explicitly false.
    #                      Missing or true means run.
    enabled_filter='select(.enabled == true)'
    routine=""
    while [[ $# -gt 0 ]]; do
      case "$1" in
        --enabled-only)      enabled_filter='select(.enabled == true)'; shift ;;
        --include-disabled)  enabled_filter='.';                         shift ;;
        --routine=*)         routine="${1#--routine=}"; shift ;;
        *) echo "list: unknown flag '$1'" >&2; exit 1 ;;
      esac
    done
    if [[ ! -f "$SETTINGS_FILE" ]]; then exit 0; fi
    # accountId map: id → mode (joined into the row so callers don't need a
    # second jq pass per bot). routine_filter applies the F3 opt-out when
    # --routine is set; jq's `// true` makes the absence-of-key default to
    # opted-in.
    if [[ -n "$routine" ]]; then
      # Exclude only when the bot has an explicit false for this routine.
      # Missing key OR true keeps the bot in the list. Note: jq's `//` is
      # "use right when left is null/false", which collapses false to true,
      # so we use `!= false` instead.
      routine_filter='select((.routineFilter // {})["'"$routine"'"] != false)'
    else
      routine_filter='.'
    fi
    jq -r --argjson enabled "{}" '
      (.accounts // [] | map({key: .id, value: .mode}) | from_entries) as $modes
      | (.bots // [])
      | map('"$enabled_filter"')
      | map('"$routine_filter"')
      | .[]
      | [.id, .accountId, (.strategySlug // "default"),
         (.allocation // "" | tostring | sub("^null$"; "")),
         ($modes[.accountId] // "unknown")]
      | @tsv
    ' "$SETTINGS_FILE"
    ;;
  count)
    if [[ ! -f "$SETTINGS_FILE" ]]; then echo 0; exit 0; fi
    jq '[.bots[]? | select(.enabled == true)] | length' "$SETTINGS_FILE"
    ;;
  env-namespace)
    [[ $# -eq 1 ]] || { echo "usage: env-namespace <account-id>" >&2; exit 1; }
    printf '%s' "$1" | tr '[:lower:]-' '[:upper:]_'
    ;;
  *)
    echo "usage: bash scripts/bots.sh {list|count|env-namespace} [...]" >&2
    exit 1
    ;;
esac
