#!/usr/bin/env bash
# Alpaca API wrapper. All trading API calls go through here.
# Usage: bash scripts/alpaca.sh <subcommand> [args...]
#
# Mode switching: set BOT_MODE=paper to use ALPACA_PAPER_* credentials and the
# paper endpoint (api/data fallback to live data feed). Default mode = live.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck source=_lib.sh
source "$ROOT/scripts/_lib.sh"
_load_env "$ROOT"
_require_jq

# -- Mode + credentials -----------------------------------------------------
# All flags below are optional, must appear before the subcommand, and may
# be combined freely. Order doesn't matter.
#
#   --mode=paper|live     Picks the legacy ALPACA_* (live) or ALPACA_PAPER_*
#                         (paper) credential set from env. Default: $BOT_MODE
#                         or "live".
#
#   --account-id=<slug>   Multi-account: looks up creds via namespaced env
#                         vars derived from the slug. Hyphens become
#                         underscores, slug uppercased. Slug "paper-100k"
#                         resolves to ALPACA_PAPER_100K_API_KEY,
#                         ALPACA_PAPER_100K_SECRET_KEY, and (optional)
#                         ALPACA_PAPER_100K_ENDPOINT. Overrides --mode-based
#                         creds when set.
#
#   --bot-id=<slug>       Tags submit-order's client_order_id with
#                         "<slug>-" prefix so the dashboard can attribute
#                         fills back to a specific bot for soft-allocation
#                         P&L. Ignored by non-write subcommands.
MODE="${BOT_MODE:-live}"
BOT_ID=""
ACCOUNT_ID=""
while true; do
  case "${1:-}" in
    --mode=*)       MODE="${1#--mode=}"; shift ;;
    --bot-id=*)     BOT_ID="${1#--bot-id=}"; shift ;;
    --account-id=*) ACCOUNT_ID="${1#--account-id=}"; shift ;;
    *)              break ;;
  esac
done

# When --account-id is set, derive the namespaced env var names and use
# those creds. Falls back to legacy ALPACA_* / ALPACA_PAPER_* based on
# --mode so local execution keeps working with the user's existing .env
# (where they have ALPACA_API_KEY but not ALPACA_LIVE_MAIN_API_KEY).
# Cloud routines must always set the namespaced vars.
if [[ -n "$ACCOUNT_ID" ]]; then
  ns="$(printf '%s' "$ACCOUNT_ID" | tr '[:lower:]-' '[:upper:]_')"
  key_var="ALPACA_${ns}_API_KEY"
  sec_var="ALPACA_${ns}_SECRET_KEY"
  ep_var="ALPACA_${ns}_ENDPOINT"
  if [[ -n "${!key_var:-}" && -n "${!sec_var:-}" ]]; then
    KEY="${!key_var}"
    SEC="${!sec_var}"
    if [[ -n "${!ep_var:-}" ]]; then
      API="${!ep_var}"
    elif [[ "$MODE" == "paper" ]]; then
      API="https://paper-api.alpaca.markets/v2"
    else
      API="https://api.alpaca.markets/v2"
    fi
  elif [[ "$MODE" == "paper" && -n "${ALPACA_PAPER_API_KEY:-}" ]]; then
    KEY="$ALPACA_PAPER_API_KEY"
    SEC="$ALPACA_PAPER_SECRET_KEY"
    API="${ALPACA_PAPER_ENDPOINT:-https://paper-api.alpaca.markets/v2}"
  elif [[ "$MODE" == "live" && -n "${ALPACA_API_KEY:-}" ]]; then
    KEY="$ALPACA_API_KEY"
    SEC="$ALPACA_SECRET_KEY"
    API="${ALPACA_ENDPOINT:-https://api.alpaca.markets/v2}"
  else
    echo "ERROR: --account-id=$ACCOUNT_ID requires \$$key_var and \$$sec_var (or legacy ALPACA_${MODE^^}_API_KEY) to be set in env" >&2
    exit 1
  fi
else
  case "$MODE" in
    paper)
      : "${ALPACA_PAPER_API_KEY:?ALPACA_PAPER_API_KEY required when BOT_MODE=paper}"
      : "${ALPACA_PAPER_SECRET_KEY:?ALPACA_PAPER_SECRET_KEY required when BOT_MODE=paper}"
      KEY="$ALPACA_PAPER_API_KEY"
      SEC="$ALPACA_PAPER_SECRET_KEY"
      API="${ALPACA_PAPER_ENDPOINT:-https://paper-api.alpaca.markets/v2}"
      ;;
    live)
      _require_env ALPACA_API_KEY ALPACA_SECRET_KEY
      KEY="$ALPACA_API_KEY"
      SEC="$ALPACA_SECRET_KEY"
      API="${ALPACA_ENDPOINT:-https://api.alpaca.markets/v2}"
      ;;
    *)
      echo "ERROR: BOT_MODE must be 'live' or 'paper' (got '$MODE')" >&2
      exit 1
      ;;
  esac
fi
DATA="${ALPACA_DATA_ENDPOINT:-https://data.alpaca.markets/v2}"

H_KEY="APCA-API-KEY-ID: $KEY"
H_SEC="APCA-API-SECRET-KEY: $SEC"

# -- Helpers ----------------------------------------------------------------
_alpaca() {
  # _alpaca [METHOD] URL [extra-curl-args…]
  _curl_retry "$@" -H "$H_KEY" -H "$H_SEC"
}

_alpaca_json() {
  # POST/PATCH a JSON body. Args: METHOD URL JSON_STRING
  local method="$1" url="$2" body="$3"
  _alpaca "$method" "$url" -H 'Content-Type: application/json' --data-raw "$body"
}

_gen_client_id() {
  # Stable-ish ID for safe POST retries. epoch-seconds + random hex.
  printf 'bsl-%s-%s' "$(date +%s)" "$(od -An -N4 -tx1 /dev/urandom | tr -d ' \n')"
}

# -- Subcommand dispatch ----------------------------------------------------
CMDS=(account positions position quote bars clock orders submit-order
      replace-order cancel cancel-all close close-all portfolio-history)

cmd="${1:-}"
shift || true

case "$cmd" in
  account)
    _alpaca GET "$API/account"
    ;;
  positions)
    _alpaca GET "$API/positions"
    ;;
  position)
    sym="${1:?usage: position SYM}"
    _alpaca GET "$API/positions/$sym"
    ;;
  quote)
    sym="${1:?usage: quote SYM}"
    _alpaca GET "$DATA/stocks/$sym/quotes/latest"
    ;;
  bars)
    sym="${1:?usage: bars SYM TIMEFRAME [start] [end] [limit]}"
    tf="${2:?usage: bars SYM TIMEFRAME (e.g. 1Day, 1Hour, 5Min)}"
    start="${3:-}"
    end="${4:-}"
    limit="${5:-1000}"
    qs="timeframe=$tf&limit=$limit"
    [[ -n "$start" ]] && qs="$qs&start=$start"
    [[ -n "$end"   ]] && qs="$qs&end=$end"
    _alpaca GET "$DATA/stocks/$sym/bars?$qs"
    ;;
  clock)
    _alpaca GET "$API/clock"
    ;;
  orders)
    status="${1:-open}"
    _alpaca GET "$API/orders?status=$status&limit=100"
    ;;
  submit-order)
    # Named-arg order builder. Generates a client_order_id so retries are safe.
    # Required: --symbol --qty --side
    # Optional: --type (default market) --tif (default day)
    #           --limit-price --stop-price --trail-percent --trail-price
    #           --client-order-id (override auto-generated id)
    sym=""; qty=""; side=""; otype="market"; tif="day"
    limit_price=""; stop_price=""; trail_pct=""; trail_price=""; coid=""
    while [[ $# -gt 0 ]]; do
      case "$1" in
        --symbol)           sym="$2"; shift 2 ;;
        --qty)              qty="$2"; shift 2 ;;
        --side)             side="$2"; shift 2 ;;
        --type)             otype="$2"; shift 2 ;;
        --tif)              tif="$2"; shift 2 ;;
        --limit-price)      limit_price="$2"; shift 2 ;;
        --stop-price)       stop_price="$2"; shift 2 ;;
        --trail-percent)    trail_pct="$2"; shift 2 ;;
        --trail-price)      trail_price="$2"; shift 2 ;;
        --client-order-id)  coid="$2"; shift 2 ;;
        *) echo "submit-order: unknown flag '$1'" >&2; exit 1 ;;
      esac
    done
    [[ -n "$sym" && -n "$qty" && -n "$side" ]] || {
      echo "usage: submit-order --symbol SYM --qty N --side buy|sell [--type market|limit|stop|trailing_stop] [--tif day|gtc] [--limit-price X] [--stop-price X] [--trail-percent X] [--trail-price X] [--client-order-id ID]" >&2
      exit 1
    }
    if [[ -z "$coid" ]]; then
      coid="$(_gen_client_id)"
      [[ -n "$BOT_ID" ]] && coid="${BOT_ID}-${coid}"
    fi
    body="$(jq -n \
      --arg s "$sym" --arg q "$qty" --arg side "$side" \
      --arg t "$otype" --arg tif "$tif" --arg coid "$coid" \
      --arg lp "$limit_price" --arg sp "$stop_price" \
      --arg tp "$trail_pct" --arg tprice "$trail_price" '
      {symbol:$s, qty:$q, side:$side, type:$t, time_in_force:$tif,
       client_order_id:$coid}
      | (if $lp != "" then .limit_price = $lp else . end)
      | (if $sp != "" then .stop_price  = $sp else . end)
      | (if $tp != "" then .trail_percent = $tp else . end)
      | (if $tprice != "" then .trail_price = $tprice else . end)
    ')"
    _alpaca_json POST "$API/orders" "$body"
    ;;
  replace-order)
    # PATCH an existing order in place — preferred over cancel+create for
    # trailing-stop adjustments so the position is never briefly un-stopped.
    if [[ $# -lt 1 ]]; then
      echo "usage: replace-order ORDER_ID [--qty N] [--limit-price X] [--stop-price X] [--trail-percent X] [--trail-price X] [--tif day|gtc]" >&2
      exit 1
    fi
    oid="$1"; shift
    qty=""; limit_price=""; stop_price=""; trail_pct=""; trail_price=""; tif=""
    while [[ $# -gt 0 ]]; do
      case "$1" in
        --qty)            qty="$2"; shift 2 ;;
        --limit-price)    limit_price="$2"; shift 2 ;;
        --stop-price)     stop_price="$2"; shift 2 ;;
        --trail-percent)  trail_pct="$2"; shift 2 ;;
        --trail-price)    trail_price="$2"; shift 2 ;;
        --tif)            tif="$2"; shift 2 ;;
        *) echo "replace-order: unknown flag '$1'" >&2; exit 1 ;;
      esac
    done
    body="$(jq -n \
      --arg q "$qty" --arg lp "$limit_price" --arg sp "$stop_price" \
      --arg tp "$trail_pct" --arg tprice "$trail_price" --arg tif "$tif" \
      --arg coid "$([[ -n "$BOT_ID" ]] && printf '%s-' "$BOT_ID")$(_gen_client_id)" '
      {client_order_id:$coid}
      | (if $q  != "" then .qty = $q else . end)
      | (if $lp != "" then .limit_price = $lp else . end)
      | (if $sp != "" then .stop_price  = $sp else . end)
      | (if $tp != "" then .trail = $tp else . end)
      | (if $tprice != "" then .trail = $tprice else . end)
      | (if $tif != "" then .time_in_force = $tif else . end)
    ')"
    _alpaca_json PATCH "$API/orders/$oid" "$body"
    ;;
  cancel)
    oid="${1:?usage: cancel ORDER_ID}"
    _alpaca DELETE "$API/orders/$oid"
    ;;
  cancel-all)
    _alpaca DELETE "$API/orders"
    ;;
  close)
    sym="${1:?usage: close SYM}"
    _alpaca DELETE "$API/positions/$sym"
    ;;
  close-all)
    _alpaca DELETE "$API/positions"
    ;;
  portfolio-history)
    # Equity curve for /benchmark. Defaults to 1-year daily.
    period="${1:-1A}"
    timeframe="${2:-1D}"
    _alpaca GET "$API/account/portfolio/history?period=$period&timeframe=$timeframe"
    ;;
  *)
    printf 'Usage: bash scripts/alpaca.sh <%s> [args]\n' "$(IFS='|'; echo "${CMDS[*]}")" >&2
    exit 1
    ;;
esac
echo
