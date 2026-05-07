#!/usr/bin/env bash
# Research wrapper. All market research goes through Perplexity.
# Usage: bash scripts/perplexity.sh "<query>"
# Exits with code 3 if PERPLEXITY_API_KEY is unset so callers can fall back.
#
# Idempotency (CLAUDE.md hard rule): the same (CT date, model, query) triple
# within one trading day is served from a local cache so multi-bot routine
# fan-out does not multiply Perplexity spend. Cache lives at
# memory/shared/.perplexity-cache.jsonl with shape:
#   {"date":"YYYY-MM-DD","key":"<sha256>","model":"<m>","response":<api-json>}

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck source=_lib.sh
source "$ROOT/scripts/_lib.sh"
_load_env "$ROOT"
_require_jq

query="${1:-}"
if [[ -z "$query" ]]; then
  echo "usage: bash scripts/perplexity.sh \"<query>\"" >&2
  exit 1
fi

if [[ -z "${PERPLEXITY_API_KEY:-}" ]]; then
  echo "WARNING: PERPLEXITY_API_KEY not set. Fall back to WebSearch." >&2
  exit 3
fi

MODEL="${PERPLEXITY_MODEL:-sonar}"

# Cost telemetry — log every query (cached or fresh) so daily-summary can
# tally call counts and flag prompt regressions that 10x spend overnight.
# PERPLEXITY-LOG.md is shared across bots (research budget pool).
PPLX_LOG="$(shared_memory_dir "$ROOT")/PERPLEXITY-LOG.md"
PPLX_CACHE="$(shared_memory_dir "$ROOT")/.perplexity-cache.jsonl"
mkdir -p "$(dirname "$PPLX_LOG")"
ts="$(TZ=America/Chicago date '+%Y-%m-%d %H:%M CT')"
today="$(TZ=America/Chicago date '+%Y-%m-%d')"
# Strip newlines from query for clean single-line logging; truncate at 200 chars.
qline="${query//$'\n'/ }"
qline="${qline:0:200}"

# Cache key: sha256(MODEL "\n" query). Same exact query from a fanned-out
# routine iteration hashes identically. Portable across macOS (shasum) and
# Linux cloud routines (sha256sum).
if command -v shasum >/dev/null 2>&1; then
  cache_key="$(printf '%s\n%s' "$MODEL" "$query" | shasum -a 256 | awk '{print $1}')"
else
  cache_key="$(printf '%s\n%s' "$MODEL" "$query" | sha256sum | awk '{print $1}')"
fi

# Cache hit? Replay the stored response and log a row tagged "(cached)" in
# the model column so the markdown table schema stays 3-column.
if [[ -f "$PPLX_CACHE" ]]; then
  cached="$(jq -c -r --arg d "$today" --arg k "$cache_key" \
    'select(.date == $d and .key == $k) | .response' "$PPLX_CACHE" 2>/dev/null \
    | head -n 1 || true)"
  if [[ -n "$cached" ]]; then
    printf '| %s | %s (cached) | %s |\n' "$ts" "$MODEL" "$qline" >> "$PPLX_LOG"
    printf '%s\n' "$cached"
    exit 0
  fi
fi

# Cache miss — log the attempt before firing so failed calls are still
# visible in the cost ledger.
printf '| %s | %s | %s |\n' "$ts" "$MODEL" "$qline" >> "$PPLX_LOG"

payload="$(jq -n --arg m "$MODEL" --arg q "$query" '{
  model: $m,
  messages: [
    {role: "system", content: "You are a precise financial research assistant. Cite every claim. Be concise."},
    {role: "user",   content: $q}
  ]
}')"

tmp="$(mktemp)"
trap 'rm -f "$tmp"' EXIT

_curl_retry POST 'https://api.perplexity.ai/chat/completions' \
  -H "Authorization: Bearer $PERPLEXITY_API_KEY" \
  -H 'Content-Type: application/json' \
  --data-raw "$payload" > "$tmp"

# Persist only valid JSON responses so a transient HTML error page never
# poisons the cache.
if jq -e . >/dev/null 2>&1 < "$tmp"; then
  jq -c -n --arg d "$today" --arg k "$cache_key" --arg m "$MODEL" \
    --slurpfile r "$tmp" '{date:$d, key:$k, model:$m, response:$r[0]}' \
    >> "$PPLX_CACHE"
fi

cat "$tmp"
echo
