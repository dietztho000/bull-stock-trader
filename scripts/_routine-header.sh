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
#   while IFS=$'\t' read -r BOT_ID ACCOUNT_ID STRATEGY BOT_ALLOCATION BOT_MODE; do
#     export BOT_ID ACCOUNT_ID STRATEGY BOT_ALLOCATION BOT_MODE
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

# Emit a `start` heartbeat once per routine (BEFORE the fan-out loop) so a
# crash mid-iteration still leaves a trace.
_routine_emit_start() {
  local routine="${1:?usage: _routine_emit_start <routine-name>}"
  bash "$ROUTINE_HEADER_ROOT/scripts/run-log.sh" start "$routine"
}

# Emit a matching `end` heartbeat after the loop.
# Status: ok|fail|noop. Defaults to ok.
_routine_emit_end() {
  local routine="${1:?usage: _routine_emit_end <routine-name> [status]}"
  local status="${2:-ok}"
  bash "$ROUTINE_HEADER_ROOT/scripts/run-log.sh" end "$routine" "$status"
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
