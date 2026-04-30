#!/usr/bin/env bash
# Research wrapper. All market research goes through Perplexity.
# Usage: bash scripts/perplexity.sh "<query>"
# Exits with code 3 if PERPLEXITY_API_KEY is unset so callers can fall back.

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

# Cost telemetry — log every query before firing so daily-summary can tally
# call counts and flag prompt regressions that 10x spend overnight.
PPLX_LOG="$ROOT/memory/PERPLEXITY-LOG.md"
mkdir -p "$(dirname "$PPLX_LOG")"
ts="$(date '+%Y-%m-%d %H:%M %Z')"
# Strip newlines from query for clean single-line logging; truncate at 200 chars.
qline="${query//$'\n'/ }"
qline="${qline:0:200}"
printf '| %s | %s | %s |\n' "$ts" "$MODEL" "$qline" >> "$PPLX_LOG"

payload="$(jq -n --arg m "$MODEL" --arg q "$query" '{
  model: $m,
  messages: [
    {role: "system", content: "You are a precise financial research assistant. Cite every claim. Be concise."},
    {role: "user",   content: $q}
  ]
}')"

_curl_retry POST 'https://api.perplexity.ai/chat/completions' \
  -H "Authorization: Bearer $PERPLEXITY_API_KEY" \
  -H 'Content-Type: application/json' \
  --data-raw "$payload"
echo
