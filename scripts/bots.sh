#!/usr/bin/env bash
# Bot registry helper. Reads memory/shared/dashboard-settings.json (the
# dashboard's source of truth, holds encrypted creds — gitignored), and
# falls back to memory/shared/bots-registry.json (committed, no secrets,
# what cloud routines see in a fresh clone).
#
# Local: dashboard-settings.json wins (the dashboard rewrites it as the
# user adds/edits bots). Cloud: only bots-registry.json exists.
# Keep the two in sync via `bash scripts/sync-bots-registry.sh`; the
# pre-push hook fails if they drift.
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
# `list` row format (TAB-separated, six columns):
#   bot_id  account_id  strategy  allocation  mode  strategy_params_json
# Where `allocation` is the literal string "null" if the bot uses the full
# account (no soft slice), `mode` is the account's mode ("live" | "paper"),
# and `strategy_params_json` is the compact-JSON params array from the
# registry's matching strategy entry (`[]` when the registry has no entry
# for the slug — routines fall back to documented defaults). Phase 4 of
# the multi-strategy upgrade.
#
# Why "null" rather than empty for the allocation field: bash's `read`
# with IFS=$'\t' treats consecutive tabs as a SINGLE delimiter when IFS
# only contains whitespace. Emitting "null" avoids the consecutive-tab
# collapse that would otherwise shift downstream fields left and clobber
# strategy_params_json.
#
# Example loop in a routine:
#   while IFS=$'\t' read -r bot_id account_id strategy allocation mode params_json; do
#     export BOT_ID="$bot_id" ACCOUNT_ID="$account_id" STRATEGY="$strategy"
#     # Translate the registry's "no allocation" sentinel back to empty
#     # so per-bot routines see a clean test ([[ -z "$BOT_ALLOCATION" ]]).
#     [[ "$allocation" == "null" ]] && allocation=""
#     export BOT_ALLOCATION="$allocation" BOT_MODE="$mode"
#     export STRATEGY_PARAMS_JSON="$params_json"
#     # _cloud-header.md unpacks the JSON into per-key STRATEGY_<KEY> vars.
#     # ... run steps ...
#   done < <(bash scripts/bots.sh list)
#
# Exits 0 even when the registry is empty so routines can no-op cleanly.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PRIMARY_FILE="$ROOT/memory/shared/dashboard-settings.json"
FALLBACK_FILE="$ROOT/memory/shared/bots-registry.json"
if [[ -f "$PRIMARY_FILE" ]]; then
  SETTINGS_FILE="$PRIMARY_FILE"
elif [[ -f "$FALLBACK_FILE" ]]; then
  SETTINGS_FILE="$FALLBACK_FILE"
else
  SETTINGS_FILE=""
fi

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
    if [[ -z "$SETTINGS_FILE" ]]; then exit 0; fi
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
      | (.strategies // [] | map({key: .slug, value: (.params // [])}) | from_entries) as $params
      | (.bots // [])
      | map('"$enabled_filter"')
      | map('"$routine_filter"')
      | .[]
      | (.strategySlug // "default") as $slug
      | [.id, .accountId, $slug,
         (if (.allocation // null) == null then "null" else (.allocation | tostring) end),
         ($modes[.accountId] // "unknown"),
         (($params[$slug] // []) | tojson)]
      | @tsv
    ' "$SETTINGS_FILE"
    ;;
  count)
    if [[ -z "$SETTINGS_FILE" ]]; then echo 0; exit 0; fi
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
