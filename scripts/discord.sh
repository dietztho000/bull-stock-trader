#!/usr/bin/env bash
# Notification wrapper. Posts to a Discord channel via webhook.
# Usage: bash scripts/discord.sh [--type=<category>] "<message>"
# Categories: research, fill, midday, eod, weekly, error (each gets an emoji prefix).
#
# Webhook routing — per-category override with single-channel fallback:
#   DISCORD_WEBHOOK_URL_<UPPERCASE_CATEGORY>   (optional, takes priority)
#   DISCORD_WEBHOOK_URL                        (fallback, also the default)
# e.g. set DISCORD_WEBHOOK_URL_EOD to send daily summaries to a different
# channel than DISCORD_WEBHOOK_URL_WEEKLY. Unset categories use the default.
# If both are unset, appends to a local fallback file.
#
# If NTFY_TOPIC is set, also POSTs to https://ntfy.sh/$NTFY_TOPIC for redundancy.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck source=_lib.sh
source "$ROOT/scripts/_lib.sh"
_load_env "$ROOT"
_require_jq

FALLBACK="$ROOT/DAILY-SUMMARY.md"

TYPE=""
args=()
while [[ $# -gt 0 ]]; do
  case "$1" in
    --type=*) TYPE="${1#--type=}"; shift ;;
    *)        args+=("$1"); shift ;;
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

# Resolve which webhook to POST to. DISCORD_WEBHOOK_URL_<TYPE_UPPER> takes
# priority over DISCORD_WEBHOOK_URL. The TYPE was constrained by the case
# above, so the env-var name we look up here is always one of the six known
# categories (no risk of attacker-controlled indirect expansion).
if [[ -n "$TYPE" ]]; then
  category_var="DISCORD_WEBHOOK_URL_$(printf '%s' "$TYPE" | tr '[:lower:]' '[:upper:]')"
  WEBHOOK="${!category_var:-${DISCORD_WEBHOOK_URL:-}}"
else
  WEBHOOK="${DISCORD_WEBHOOK_URL:-}"
fi

if [[ $# -gt 0 ]]; then
  msg="$*"
else
  msg="$(cat)"
fi

[[ -n "$EMOJI" ]] && msg="$EMOJI $msg"

if [[ -z "${msg// /}" ]]; then
  echo "usage: bash scripts/discord.sh \"<message>\"" >&2
  exit 1
fi

# Discord enforces a 2000-char message limit. Truncate with notice.
if [[ ${#msg} -gt 1900 ]]; then
  msg="${msg:0:1900}…(truncated)"
fi

# ntfy.sh mirror — boring-tech redundancy. No creds needed; pick a long, hard-
# to-guess topic name in NTFY_TOPIC. Fire-and-forget, never blocks Discord.
_mirror_ntfy() {
  if [[ -n "${NTFY_TOPIC:-}" ]]; then
    curl -sS --ssl-no-revoke --max-time 5 \
      -H "Title: bull-stock-trader" \
      -d "$msg" \
      "https://ntfy.sh/$NTFY_TOPIC" >/dev/null 2>&1 || true
  fi
}

stamp="$(date '+%Y-%m-%d %H:%M %Z')"

if [[ -z "$WEBHOOK" ]]; then
  printf "\n---\n## %s (fallback — Discord not configured)\n%s\n" "$stamp" "$msg" >> "$FALLBACK"
  echo "[discord fallback] appended to DAILY-SUMMARY.md"
  echo "$msg"
  _mirror_ntfy
  exit 0
fi

payload="$(jq -Rn --arg c "$msg" '{content:$c}')"

_curl_retry POST "$WEBHOOK" \
  -H 'Content-Type: application/json' \
  --data-raw "$payload"
echo
_mirror_ntfy
