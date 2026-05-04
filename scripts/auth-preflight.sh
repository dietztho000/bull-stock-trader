#!/usr/bin/env bash
# Auth preflight wrapper. Runs alpaca.sh account and on failure captures the
# stderr/stdout, fires a Discord --type=error with the underlying cause,
# logs the routine as failed, and exits with the same non-zero code.
#
# Usage: bash scripts/auth-preflight.sh <routine-name> [--account-id=<slug>]
#
# Why this exists: the previous header just ran `alpaca.sh account` and on
# any non-zero fired a generic "check ALPACA_API_KEY / ALPACA_SECRET_KEY /
# ALPACA_ENDPOINT" message. That meant a real 401 from key drift, a missing
# env var, and a 5xx outage all looked identical in Discord — forcing a
# UI hunt through the routine's run log to find the actual error.
#
# When --account-id is set, the failure message names the account so the
# user knows which credential set drifted (when N bots run via fan-out).

set -uo pipefail   # deliberately NOT -e — we capture exit codes ourselves

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
routine="${1:-unknown}"
shift || true

account_id=""
alpaca_args=()
while [[ $# -gt 0 ]]; do
  case "$1" in
    --account-id=*)
      account_id="${1#--account-id=}"
      alpaca_args+=("--account-id=$account_id")
      shift
      ;;
    *) shift ;;
  esac
done

output=$(bash "$ROOT/scripts/alpaca.sh" "${alpaca_args[@]}" account 2>&1)
rc=$?

if [[ $rc -eq 0 ]]; then
  echo "$output"
  exit 0
fi

# Failure path — emit a paired start/end on a discriminated routine marker
# so the daily-summary EOD watchdog can tell preflight failures from
# in-flight failures, and so each fan-out iteration's failure is uniquely
# attributable to its bot/account. The routine-level start was already
# emitted by the cloud header; we deliberately do NOT emit a routine-level
# "end fail" here — one bot's bad creds must not poison the whole routine's
# heartbeat when other bots ran fine.
preflight_marker="${routine}:preflight:${BOT_ID:-${account_id:-unknown}}"
bash "$ROOT/scripts/run-log.sh" start "$preflight_marker" >/dev/null 2>&1 || true
bash "$ROOT/scripts/run-log.sh" end "$preflight_marker" fail >/dev/null 2>&1 || true

# Discord caps at 2000 chars; leave room for the prefix lines.
# Route auth-canary's own preflight failures to the auth-canary channel,
# since that channel is dedicated to bot-health signals. All other
# routines' preflight failures are real workflow errors → error channel.
truncated="${output:0:1400}"
if [[ "$routine" == "auth-canary" ]]; then
  msg_type="auth-canary"
else
  msg_type="error"
fi
when="$(date '+%Y-%m-%d %H:%M %Z')"
acct_label=""
[[ -n "$account_id" ]] && acct_label=" [account=${account_id}]"
bash "$ROOT/scripts/discord.sh" --type="$msg_type" \
  "⚠️ ${routine} preflight FAILED${acct_label} — ${when}

Exit code: ${rc}

\`\`\`
${truncated}
\`\`\`

Action: fix and re-run." || true

# Surface the captured output to the routine's run log too, so the cloud
# UI shows the same context the Discord post had.
echo "$output" >&2
exit "$rc"
