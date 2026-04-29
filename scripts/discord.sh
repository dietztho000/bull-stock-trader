#!/usr/bin/env bash
# Notification wrapper. Posts to a Discord channel via webhook.
# Usage: bash scripts/discord.sh [--type=<category>] "<message>"
# Categories: research, fill, midday, eod, weekly, error (each gets an emoji prefix).
# If DISCORD_WEBHOOK_URL is unset, appends to a local fallback file.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="$ROOT/.env"
FALLBACK="$ROOT/DAILY-SUMMARY.md"

if [[ -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
fi

TYPE=""
args=()
for a in "$@"; do
  case "$a" in
    --type=*) TYPE="${a#--type=}" ;;
    *) args+=("$a") ;;
  esac
done
set -- "${args[@]+"${args[@]}"}"

case "$TYPE" in
  research) EMOJI="🔬" ;;
  fill)     EMOJI="🟢" ;;
  midday)   EMOJI="🎯" ;;
  eod)      EMOJI="📈" ;;
  weekly)   EMOJI="📋" ;;
  error)    EMOJI="⚠️" ;;
  *)        EMOJI="" ;;
esac

if [[ $# -gt 0 ]]; then
  msg="$*"
else
  msg="$(cat)"
fi

if [[ -n "$EMOJI" ]]; then
  msg="$EMOJI $msg"
fi

if [[ -z "${msg// /}" ]]; then
  echo "usage: bash scripts/discord.sh \"<message>\"" >&2
  exit 1
fi

stamp="$(date '+%Y-%m-%d %H:%M %Z')"

if [[ -z "${DISCORD_WEBHOOK_URL:-}" ]]; then
  printf "\n---\n## %s (fallback — Discord not configured)\n%s\n" "$stamp" "$msg" >> "$FALLBACK"
  echo "[discord fallback] appended to DAILY-SUMMARY.md"
  echo "$msg"
  exit 0
fi

# Discord enforces a 2000-char message limit. Truncate with notice.
if [[ ${#msg} -gt 1900 ]]; then
  msg="${msg:0:1900}…(truncated)"
fi

if command -v python3 >/dev/null 2>&1; then
  PY=python3
elif command -v python >/dev/null 2>&1; then
  PY=python
else
  echo "ERROR: python or python3 is required to JSON-encode the payload" >&2
  exit 1
fi

payload="$($PY -c "
import json, sys
print(json.dumps({'content': sys.argv[1]}))
" "$msg")"

curl -fsS --ssl-no-revoke -X POST \
  "$DISCORD_WEBHOOK_URL" \
  -H "Content-Type: application/json" \
  -d "$payload"
echo
