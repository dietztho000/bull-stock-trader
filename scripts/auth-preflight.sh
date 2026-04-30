#!/usr/bin/env bash
# Auth preflight wrapper. Runs alpaca.sh account and on failure captures the
# stderr/stdout, fires a Discord --type=error with the underlying cause,
# logs the routine as failed, and exits with the same non-zero code.
#
# Usage: bash scripts/auth-preflight.sh <routine-name>
#
# Why this exists: the previous header just ran `alpaca.sh account` and on
# any non-zero fired a generic "check ALPACA_API_KEY / ALPACA_SECRET_KEY /
# ALPACA_ENDPOINT" message. That meant a real 401 from key drift, a missing
# env var, and a 5xx outage all looked identical in Discord — forcing a
# UI hunt through the routine's run log to find the actual error.

set -uo pipefail   # deliberately NOT -e — we capture exit codes ourselves

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
routine="${1:-unknown}"

output=$(bash "$ROOT/scripts/alpaca.sh" account 2>&1)
rc=$?

if [[ $rc -eq 0 ]]; then
  echo "$output"
  exit 0
fi

# Failure path — log run-end as fail, post Discord with captured cause.
bash "$ROOT/scripts/run-log.sh" end "$routine" fail >/dev/null 2>&1 || true

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
bash "$ROOT/scripts/discord.sh" --type="$msg_type" \
  "⚠️ ${routine} preflight FAILED — ${when}

Exit code: ${rc}

\`\`\`
${truncated}
\`\`\`

Action: fix and re-run." || true

# Surface the captured output to the routine's run log too, so the cloud
# UI shows the same context the Discord post had.
echo "$output" >&2
exit "$rc"
