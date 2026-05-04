#!/usr/bin/env bash
# Shared helpers for scripts/*.sh — sourced, not executed.
#
# Exit-code contract (every wrapper aligns with this):
#   0 = ok
#   1 = usage error (bad subcommand, missing arg)
#   2 = runtime error (API failure after retries)
#   3 = missing-key fallback (caller branches on this — currently only perplexity.sh)

# Per-bot/per-strategy memory directory.
# Layout: memory/<bot>/<strategy>/  e.g. memory/live/default/, memory/momentum-10k/default/
#
# Precedence: BOT_ID (registry slug, e.g. "momentum-10k") wins when set so
# custom-named bots get their own memory tree. Falls back to BOT_MODE
# (account mode "live"|"paper") for legacy single-bot callers, then to "live".
memory_dir_for() {
  local root="${1:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
  local bot="${BOT_ID:-${BOT_MODE:-live}}"
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

# _curl_retry [METHOD] URL [curl-args…]
# Retries up to 3 attempts on 5xx / network errors with exponential backoff
# (1s, 2s, 4s). 4xx aborts immediately — those are caller bugs, not transient.
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
  local tmp
  tmp="$(mktemp)"
  while (( attempt <= 3 )); do
    http_code="$(curl -sS --ssl-no-revoke -o "$tmp" -w '%{http_code}' \
                  -X "$method" "$@" "$url" || echo 000)"
    if [[ "$http_code" =~ ^2 ]]; then
      cat "$tmp"
      rm -f "$tmp"
      return 0
    fi
    # 4xx — caller bug; do not retry, surface body and exit non-zero
    if [[ "$http_code" =~ ^4 ]]; then
      cat "$tmp" >&2
      printf '\nERROR: %s %s -> HTTP %s\n' "$method" "$url" "$http_code" >&2
      rm -f "$tmp"
      return 2
    fi
    # 5xx / 000 (network) — retry
    if (( attempt < 3 )); then
      printf 'WARN: %s %s -> HTTP %s (attempt %d/3, retrying in %ds)\n' \
        "$method" "$url" "$http_code" "$attempt" "$delay" >&2
      sleep "$delay"
      delay=$(( delay * 2 ))
    fi
    attempt=$(( attempt + 1 ))
  done
  cat "$tmp" >&2
  printf '\nERROR: %s %s failed after 3 attempts (last HTTP %s)\n' \
    "$method" "$url" "$http_code" >&2
  rm -f "$tmp"
  return $rc
}
