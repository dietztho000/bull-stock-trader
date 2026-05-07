#!/usr/bin/env bash
# Notification wrapper. Posts to a Discord channel via webhook.
# Usage: bash scripts/discord.sh [--type=<category>] "<message>"
# Categories: research, fill, midday, stops, eod, weekly, error, auth-canary, alert
# (each gets an emoji prefix). The "alert" category is reserved for the
# local price-monitor and skips Discord entirely when NTFY_TOPIC is set,
# routing to ntfy.sh push only — keeps high-frequency alerts off the
# Discord webhook rate limit (rule #18).
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
  research)    EMOJI="🔬" ;;
  fill)        EMOJI="🟢" ;;
  midday)      EMOJI="🎯" ;;
  stops)       EMOJI="🛡️" ;;
  eod)         EMOJI="📈" ;;
  weekly)      EMOJI="📋" ;;
  error)       EMOJI="⚠️" ;;
  auth-canary) EMOJI="📡" ;;
  alert)       EMOJI="⚠️" ;;
  *)           EMOJI="" ;;
esac

# `alert` category routes to ntfy.sh ONLY (skip Discord) so high-frequency
# price-monitor warnings don't burn the Discord webhook rate limit.
# Falls back to Discord-or-fallback file if NTFY_TOPIC is unset.
ALERT_NTFY_ONLY=0
if [[ "$TYPE" == "alert" && -n "${NTFY_TOPIC:-}" ]]; then
  ALERT_NTFY_ONLY=1
fi

# Resolve which webhook to POST to. DISCORD_WEBHOOK_URL_<TYPE_UPPER> takes
# priority over DISCORD_WEBHOOK_URL. The TYPE was constrained by the case
# above, so the env-var name we look up here is always one of the known
# categories (no risk of attacker-controlled indirect expansion). Hyphens
# in TYPE (e.g. "auth-canary") are converted to underscores so the env var
# name is shell-valid (DISCORD_WEBHOOK_URL_AUTH_CANARY).
if [[ -n "$TYPE" ]]; then
  category_var="DISCORD_WEBHOOK_URL_$(printf '%s' "$TYPE" | tr '[:lower:]' '[:upper:]' | tr '-' '_')"
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

stamp="$(TZ=America/Chicago date '+%Y-%m-%d %H:%M CT')"

# alert + NTFY_TOPIC: ntfy-only routing (skip Discord)
if [[ "$ALERT_NTFY_ONLY" == "1" ]]; then
  _mirror_ntfy
  echo "[alert -> ntfy: $NTFY_TOPIC]"
  exit 0
fi

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
