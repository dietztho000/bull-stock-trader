#!/usr/bin/env bash
# _routine-header.sh — shared scaffolding for routines that fan out across
# the bot registry. Sourced by every cloud routine (via the inline preamble
# in routines/_cloud-header.md) and by ad-hoc local commands that want the
# same fan-out semantics without duplicating the boilerplate.
#
# Pattern:
#
#   source scripts/_routine-header.sh
#   _routine_assert_bots_present pre-market   # Discord error + exit if 0 enabled
#   _routine_emit_start          pre-market   # heartbeat: routine fired
#
#   while IFS=$'\t' read -r BOT_ID ACCOUNT_ID STRATEGY BOT_ALLOCATION BOT_MODE STRATEGY_PARAMS_JSON; do
#     export BOT_ID ACCOUNT_ID STRATEGY BOT_ALLOCATION BOT_MODE STRATEGY_PARAMS_JSON
#     _routine_export_strategy_params           # → STRATEGY_<KEY> + STRATEGY_<KEY>_JSON
#     _routine_preflight_or_skip pre-market || continue
#     # STEP 1..N below — alpaca.sh calls include
#     # --account-id="$ACCOUNT_ID" --bot-id="$BOT_ID"
#   done < <(bash scripts/bots.sh list)
#
#   _routine_emit_end pre-market ok
#
# The functions are intentionally tiny so a routine can substitute its own
# behavior (e.g. report a different status on a partial run) without losing
# clarity. All write to stderr; nothing reads stdin.

# Resolve repo root once. Callers can pre-set ROUTINE_HEADER_ROOT to skip
# the cd-up dance (useful in tests).
ROUTINE_HEADER_ROOT="${ROUTINE_HEADER_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"

# Abort the routine with a single Discord --type=error post when the
# registry has no enabled bots. Exits 0 so the cron run records as "fired
# but did nothing", not "failed".
_routine_assert_bots_present() {
  local routine="${1:?usage: _routine_assert_bots_present <routine-name>}"
  local count
  count="$(bash "$ROUTINE_HEADER_ROOT/scripts/bots.sh" count)"
  if [[ "$count" == "0" ]]; then
    bash "$ROUTINE_HEADER_ROOT/scripts/discord.sh" --type=error \
      "No enabled bots in registry — aborting $routine"
    exit 0
  fi
}

# Emit a `start` heartbeat once per routine, recorded in EVERY enabled
# bot's RUN-LOG.jsonl so the EOD watchdog (which reads any one bot's log)
# always sees the routine fired. Called BEFORE the fan-out loop so a crash
# mid-iteration still leaves a trace. Iterating internally is required
# because BOT_ID is unset before the loop and would otherwise route every
# write to the same fallback bot — losing the per-bot audit signal.
_routine_emit_start() {
  local routine="${1:?usage: _routine_emit_start <routine-name>}"
  _emit_run_log_for_each_bot start "$routine" ok
}

# Emit a matching `end` heartbeat after the loop, in every bot's
# RUN-LOG.jsonl for the same reason as start. Status: ok|fail|noop.
_routine_emit_end() {
  local routine="${1:?usage: _routine_emit_end <routine-name> [status]}"
  local status="${2:-ok}"
  _emit_run_log_for_each_bot end "$routine" "$status"
}

# Internal: write a single run-log row per enabled bot, with that bot's
# BOT_ID/STRATEGY exported only for the duration of each invocation. We
# explicitly DO NOT iterate via $(bots.sh list) and a subshell loop — the
# read-while pattern keeps stdout from earlier writes from racing.
_emit_run_log_for_each_bot() {
  # Note: avoid `local status=…` — zsh treats `$status` as read-only when
  # this file is sourced interactively. Rename to `run_status` so the
  # helpers work the same when called from bash, zsh, or via `bash …`.
  local action="$1" routine="$2" run_status="$3"
  local bot acct strat alloc mode params_json
  # acct/alloc/mode/params_json are intentionally consumed but unused
  # here — bots.sh list emits 6 fields per row (Phase 4 added the params
  # JSON) and we only need bot+strategy for the heartbeat write. The
  # literal "null" sentinel for empty allocation prevents IFS-tab from
  # collapsing consecutive delimiters; we don't need to translate it
  # back here because we don't use $alloc.
  # shellcheck disable=SC2034
  while IFS=$'\t' read -r bot acct strat alloc mode params_json; do
    [[ -z "$bot" ]] && continue
    BOT_ID="$bot" STRATEGY="${strat:-default}" \
      bash "$ROUTINE_HEADER_ROOT/scripts/run-log.sh" "$action" "$routine" "$run_status" \
      >/dev/null
  done < <(bash "$ROUTINE_HEADER_ROOT/scripts/bots.sh" list)
}

# Unpack the per-bot STRATEGY_PARAMS_JSON exported by the fan-out loop
# into per-key env vars. Phase 4 of the multi-strategy upgrade.
#
# - number / percent / enum params: exported as `STRATEGY_<KEY>=<value>`
#   where <value> is the raw scalar (numbers stay as numbers, enums stay
#   as strings).
# - table params: exported as `STRATEGY_<KEY>_JSON=<compact-json-array>`.
#   Routines look up rows with `jq -r '.[] | select(.k==…) | .v'`.
#
# A missing or empty STRATEGY_PARAMS_JSON is a no-op — routines fall back
# to documented defaults via `${STRATEGY_<KEY>:-<default>}` substitution,
# which keeps default-strategy bots byte-identical to pre-Phase-4 runs.
#
# Bash 3.2-safe (macOS): no `mapfile`, no `declare -A`. Uses `printf -v`
# for indirect assignment (bash 3.1+) followed by `export "$name"` —
# clearer than eval and shellcheck-clean.
_routine_export_strategy_params() {
  [[ -z "${STRATEGY_PARAMS_JSON:-}" || "$STRATEGY_PARAMS_JSON" == "null" ]] && return 0
  local params_count
  params_count=$(printf '%s' "$STRATEGY_PARAMS_JSON" | jq 'length' 2>/dev/null || echo 0)
  [[ "$params_count" == "0" ]] && return 0
  local i kind key raw export_name
  for ((i = 0; i < params_count; i++)); do
    kind=$(printf '%s' "$STRATEGY_PARAMS_JSON" | jq -r ".[$i].kind")
    key=$(printf '%s' "$STRATEGY_PARAMS_JSON" | jq -r ".[$i].key")
    [[ "$key" =~ ^[A-Z][A-Z0-9_]*$ ]] || continue
    case "$kind" in
      number|percent|enum)
        raw=$(printf '%s' "$STRATEGY_PARAMS_JSON" | jq -r ".[$i].value")
        export_name="STRATEGY_${key}"
        printf -v "$export_name" '%s' "$raw"
        export "${export_name?}"
        ;;
      table)
        raw=$(printf '%s' "$STRATEGY_PARAMS_JSON" | jq -c ".[$i].rows")
        export_name="STRATEGY_${key}_JSON"
        printf -v "$export_name" '%s' "$raw"
        export "${export_name?}"
        ;;
    esac
  done
}

# Per-iteration preflight. Returns non-zero when the bot's creds are bad —
# the caller should `continue` to skip this iteration. The helper at
# scripts/auth-preflight.sh already posts Discord + emits a discriminated
# RUN-LOG entry on failure, so callers don't need to replicate that.
#
# Requires $ACCOUNT_ID to be exported (the fan-out loop sets it).
_routine_preflight_or_skip() {
  local routine="${1:?usage: _routine_preflight_or_skip <routine-name>}"
  bash "$ROUTINE_HEADER_ROOT/scripts/auth-preflight.sh" "$routine" \
    --account-id="$ACCOUNT_ID"
}
