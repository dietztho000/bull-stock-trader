#!/usr/bin/env bash
# Shared helpers for scripts/*.sh — sourced, not executed.
#
# ─── Bot-id contract ────────────────────────────────────────────────────
# Two distinct concepts the bash side conflated pre-2026-05-03 (audit G1/A1):
#
#   BOT_ID    = registry slug (e.g. "momentum-10k", "live", "paper").
#               Identifies a bot in memory/shared/dashboard-settings.json
#               and decides which memory tree the bot writes to:
#               memory/<BOT_ID>/<STRATEGY>/.
#
#   BOT_MODE  = the bound Alpaca account's mode ("live" | "paper").
#               Only relevant for credential routing; NEVER use it as a
#               directory or namespace key.
#
# Precedence (resolved by _resolve_bot_id below):
#   1. $BOT_ID                  — set by routine fan-out from bots.sh list
#   2. $BOT_MODE                — legacy single-bot mode (no registry)
#   3. "live"                   — final fallback for env-less smoke tests
#
# Strategy slug defaults to "default". Override via $STRATEGY for paper
# experiments running alongside the main bot.
#
# ─── Exit-code contract ─────────────────────────────────────────────────
#   0 = ok
#   1 = usage error (bad subcommand, missing arg)
#   2 = runtime error (API failure after retries)
#   3 = missing-key fallback (caller branches on this — currently only perplexity.sh)

# Resolve the active bot id according to the precedence above. Echoes the
# resolved id to stdout — single line, no newline-trailing assumptions.
_resolve_bot_id() {
  printf '%s' "${BOT_ID:-${BOT_MODE:-live}}"
}

# Per-bot/per-strategy memory directory.
# Layout: memory/<bot>/<strategy>/  e.g. memory/live/default/, memory/momentum-10k/default/
memory_dir_for() {
  local root="${1:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
  local bot
  bot="$(_resolve_bot_id)"
  local strategy="${STRATEGY:-default}"
  printf '%s/memory/%s/%s' "$root" "$bot" "$strategy"
}

# Cross-bot shared memory directory (calendars, sector cache, dashboard prefs).
shared_memory_dir() {
  local root="${1:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
  printf '%s/memory/shared' "$root"
}

# _load_env: source $REPO_ROOT/.env if present so wrappers work both locally and
# in cloud routines (cloud has env vars exported directly; .env is absent there).
#
# Existing env vars WIN — .env values only fill in what's not already set.
# This lets the dashboard pass per-account credentials via spawn(env: …)
# without .env clobbering them. (Cloud routines already work this way: env
# is set first, .env is absent.)
_load_env() {
  local root="${1:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
  local env_file="$root/.env"
  [[ -f "$env_file" ]] || return 0
  local line key val
  while IFS= read -r line || [[ -n "$line" ]]; do
    [[ -z "$line" || "$line" =~ ^[[:space:]]*# ]] && continue
    if [[ "$line" =~ ^[[:space:]]*([A-Za-z_][A-Za-z0-9_]*)[[:space:]]*=(.*)$ ]]; then
      key="${BASH_REMATCH[1]}"
      val="${BASH_REMATCH[2]}"
      # strip surrounding quotes
      [[ "$val" =~ ^\"(.*)\"$ ]] && val="${BASH_REMATCH[1]}"
      [[ "$val" =~ ^\'(.*)\'$ ]] && val="${BASH_REMATCH[1]}"
      # only set if not already in env
      [[ -z "${!key:-}" ]] && export "$key=$val"
    fi
  done < "$env_file"
}

# _require_env VAR1 VAR2 …  exits 1 with a uniform message if any are unset.
_require_env() {
  local missing=()
  local v
  for v in "$@"; do
    [[ -n "${!v:-}" ]] || missing+=("$v")
  done
  if [[ ${#missing[@]} -gt 0 ]]; then
    printf 'ERROR: required env var(s) not set: %s\n' "${missing[*]}" >&2
    exit 1
  fi
}

# _has_jq: jq is preferred for JSON encoding; we error early if absent so
# routines fail loud instead of silently producing bad payloads.
_require_jq() {
  if ! command -v jq >/dev/null 2>&1; then
    printf 'ERROR: jq is required (brew install jq / apt-get install jq)\n' >&2
    exit 2
  fi
}

# _parse_retry_after FILE
# Echoes the Retry-After header value from FILE in integer seconds, or
# nothing if the header is missing/unparseable. Handles both forms:
#   Retry-After: 120                              # seconds (delta)
#   Retry-After: Wed, 21 Oct 2026 07:28:00 GMT    # HTTP-date
# Capped at 60s by the caller so a misconfigured server can't stall a
# routine for hours.
_parse_retry_after() {
  local hdr_file="$1"
  local val
  # tolower($0) for the match keeps us portable across BSD awk (macOS,
  # which lacks IGNORECASE) and gawk. The substring extracts everything
  # after the colon-space delimiter from the original (case-preserving)
  # line, then trims a trailing CR.
  val="$(awk '
    tolower($0) ~ /^retry-after:[[:space:]]/ {
      v = substr($0, index($0, ":") + 2)
      sub(/\r$/, "", v)
      print v
      exit
    }
  ' "$hdr_file")"
  [[ -z "$val" ]] && return 0
  if [[ "$val" =~ ^[0-9]+$ ]]; then
    printf '%s' "$val"
    return 0
  fi
  # HTTP-date — try macOS BSD date, then GNU date, then give up.
  local target_epoch now delta
  if target_epoch="$(date -u -j -f '%a, %d %b %Y %H:%M:%S %Z' "$val" '+%s' 2>/dev/null)" \
     || target_epoch="$(date -u -d "$val" '+%s' 2>/dev/null)"; then
    now="$(date -u '+%s')"
    delta=$(( target_epoch - now ))
    (( delta < 0 )) && delta=0
    printf '%s' "$delta"
  fi
}

# _curl_retry [METHOD] URL [curl-args…]
# Retries up to 3 attempts on 5xx, 429, and network errors. 4xx other than
# 429 aborts immediately — those are caller bugs, not transient. 429
# (rate-limited) is treated as retryable per RFC 7231; when the response
# carries a Retry-After header that value is honored (capped at 60s) in
# place of the exponential backoff (1s, 2s, 4s).
#
# Default method is GET; pass METHOD as the first arg only when it is one of
# GET POST DELETE PATCH PUT (otherwise it is treated as a curl arg).
#
# IMPORTANT: only safe for idempotent calls. POST callers that are not
# idempotent must pass a client_order_id (or similar) so a retried request
# does not double-execute.
_curl_retry() {
  local method=GET
  case "${1:-}" in
    GET|POST|DELETE|PATCH|PUT) method="$1"; shift ;;
  esac
  local url="$1"; shift
  local attempt=1 delay=1 http_code rc=2
  local tmp hdr
  tmp="$(mktemp)"
  hdr="$(mktemp)"
  while (( attempt <= 3 )); do
    : > "$hdr"
    http_code="$(curl -sS --ssl-no-revoke -o "$tmp" -D "$hdr" -w '%{http_code}' \
                  -X "$method" "$@" "$url" || echo 000)"
    if [[ "$http_code" =~ ^2 ]]; then
      cat "$tmp"
      rm -f "$tmp" "$hdr"
      return 0
    fi
    # 4xx other than 429 — caller bug; do not retry, surface body and exit
    # non-zero. 429 falls through to the retry path below.
    if [[ "$http_code" =~ ^4 && "$http_code" != "429" ]]; then
      cat "$tmp" >&2
      printf '\nERROR: %s %s -> HTTP %s\n' "$method" "$url" "$http_code" >&2
      rm -f "$tmp" "$hdr"
      return 2
    fi
    # 5xx / 429 / 000 (network) — retry. For 429, prefer the server's
    # Retry-After hint over our exponential backoff. Cap at 60s.
    if (( attempt < 3 )); then
      local sleep_for="$delay"
      if [[ "$http_code" == "429" ]]; then
        local hint
        hint="$(_parse_retry_after "$hdr")"
        if [[ -n "$hint" ]]; then
          sleep_for="$hint"
          (( sleep_for > 60 )) && sleep_for=60
        fi
        printf 'WARN: %s %s -> HTTP 429 rate-limited (attempt %d/3, retrying in %ds)\n' \
          "$method" "$url" "$attempt" "$sleep_for" >&2
      else
        printf 'WARN: %s %s -> HTTP %s (attempt %d/3, retrying in %ds)\n' \
          "$method" "$url" "$http_code" "$attempt" "$sleep_for" >&2
      fi
      sleep "$sleep_for"
      delay=$(( delay * 2 ))
    fi
    attempt=$(( attempt + 1 ))
  done
  cat "$tmp" >&2
  printf '\nERROR: %s %s failed after 3 attempts (last HTTP %s)\n' \
    "$method" "$url" "$http_code" >&2
  rm -f "$tmp" "$hdr"
  return $rc
}
