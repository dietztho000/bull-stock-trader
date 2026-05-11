#!/usr/bin/env bash
# Notification wrapper. Posts to a Discord channel via webhook.
# Usage: bash scripts/discord.sh [--type=<category>] [--bot-id=<id>] [--bot-name=<name>] "<message>"
# Categories: research, fill, midday, stops, eod, weekly, error, auth-canary, alert
# (each gets an emoji prefix). The "alert" category is reserved for the
# local price-monitor and skips Discord entirely when NTFY_TOPIC is set,
# routing to ntfy.sh push only — keeps high-frequency alerts off the
# Discord webhook rate limit (rule #18).
#
# Webhook routing — precedence (highest → lowest):
#   DISCORD_WEBHOOK_URL_<UPPERCASE_BOT_ID>     (per-bot, hyphens → underscores)
#   DISCORD_WEBHOOK_URL_<UPPERCASE_CATEGORY>   (per-category)
#   DISCORD_WEBHOOK_URL                        (default fallback)
# Set DISCORD_WEBHOOK_URL_PAPER to route the `paper` bot's messages to a
# dedicated channel, or DISCORD_WEBHOOK_URL_EOD to send daily summaries to
# a different channel than DISCORD_WEBHOOK_URL_WEEKLY. Unset routes fall
# through to the next-priority webhook; if all are unset, the message is
# appended to a local fallback file.
#
# Identity — messages are prefixed with [<bot-name>] (preferred) or
# [<bot-id>] when set, so a shared channel can still distinguish multi-
# bot output. --bot-id/--bot-name flags override; when absent the env
# vars $BOT_ID / $BOT_NAME are read (routines/_cloud-header.md exports
# these per iteration so existing call sites pick up identity for free).
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
BOT_ID_ARG=""
BOT_NAME_ARG=""
args=()
while [[ $# -gt 0 ]]; do
  case "$1" in
    --type=*)      TYPE="${1#--type=}"; shift ;;
    --bot-id=*)    BOT_ID_ARG="${1#--bot-id=}"; shift ;;
    --bot-name=*)  BOT_NAME_ARG="${1#--bot-name=}"; shift ;;
    *)             args+=("$1"); shift ;;
  esac
done
set -- "${args[@]+"${args[@]}"}"

# Identity resolution. Flags win; env vars (set by routines/_cloud-header.md's
# per-bot fan-out loop) are the fallback so the 26 existing routine call
# sites never need to pass --bot-id/--bot-name explicitly.
BOT_ID_VAL="${BOT_ID_ARG:-${BOT_ID:-}}"
BOT_NAME_VAL="${BOT_NAME_ARG:-${BOT_NAME:-}}"

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

# Resolve which webhook to POST to. Precedence (highest → lowest):
#   DISCORD_WEBHOOK_URL_<BOT_ID>    (per-bot, hyphens → underscores)
#   DISCORD_WEBHOOK_URL_<TYPE>      (per-category)
#   DISCORD_WEBHOOK_URL             (default)
# BOT_ID is the registry slug (constrained by Zod's slugSchema to
# [a-z0-9-]+) and TYPE is constrained by the case statement above — both
# yield shell-valid env-var names with no risk of attacker-controlled
# indirect expansion.
WEBHOOK=""
if [[ -n "$BOT_ID_VAL" ]]; then
  bot_var="DISCORD_WEBHOOK_URL_$(printf '%s' "$BOT_ID_VAL" | tr '[:lower:]' '[:upper:]' | tr '-' '_')"
  WEBHOOK="${!bot_var:-}"
fi
if [[ -z "$WEBHOOK" && -n "$TYPE" ]]; then
  category_var="DISCORD_WEBHOOK_URL_$(printf '%s' "$TYPE" | tr '[:lower:]' '[:upper:]' | tr '-' '_')"
  WEBHOOK="${!category_var:-}"
fi
WEBHOOK="${WEBHOOK:-${DISCORD_WEBHOOK_URL:-}}"

if [[ $# -gt 0 ]]; then
  msg="$*"
else
  msg="$(cat)"
fi

# Identity prefix. Human-readable name when set; slug fallback; nothing
# at all when neither is set (preserves backward compat for ad-hoc callers
# like price-monitor.sh and smoke tests). Sanitize tabs/newlines in the
# name defensively — schema says max 60 chars but doesn't forbid them.
identity=""
if [[ -n "$BOT_NAME_VAL" ]]; then
  identity="$(printf '%s' "$BOT_NAME_VAL" | tr '\n\t' '  ')"
elif [[ -n "$BOT_ID_VAL" ]]; then
  identity="$BOT_ID_VAL"
fi
[[ -n "$identity" ]] && msg="[$identity] $msg"
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
