#!/usr/bin/env bash
# eod-health.sh — deterministic EOD health computation for daily-summary.
#
# Replaces the prose-driven grep/count/stash logic that daily-summary STEPs
# 6-7 used to ask the AI agent to perform by hand. That hand-execution was
# unreliable: on 2026-05-14 the EOD post claimed "0/12 routines fired" and
# "$0 Perplexity" even though RUN-LOG.jsonl held all 11 prior routines
# logged end/ok and PERPLEXITY-LOG.md held 2 rows for the day. This script
# computes both deterministically so the numbers are always correct.
#
# Usage:
#   bash scripts/eod-health.sh [--mode=daily|refresh] [--date=YYYY-MM-DD] \
#                              [--format=kv|json] [--post]
#
#   --mode    daily   (default) — the EOD watchdog used by daily-summary.
#                     EXPECTED = the full 12-routine weekday set (+ weekly-review
#                     on Fridays). Also runs the Perplexity tally.
#             refresh — the Sat/Sun weekend watchdog used by refresh-watchdog.
#                     EXPECTED = the 3 daily refresh routines only. Perplexity
#                     tally + cost-spike post are skipped; the watchdog Discord
#                     body uses the refresh-watchdog "(weekend)" format.
#   --date    Override "today". When given it is used verbatim for BOTH the
#             run-log check and the Perplexity check (test hermeticity).
#             When absent the script computes them itself — and they differ
#             on purpose (see the timezone note below).
#   --format  kv (default) emits shell-evalable KEY=VALUE lines on stdout;
#             json emits a single jq object.
#   --post    Also fire the watchdog (--type=auth-canary) and (daily mode only)
#             Perplexity cost-spike (--type=error) Discord posts when their
#             thresholds trip. Discord output is sent to stderr so stdout stays
#             a clean KEY=VALUE stream that the caller can `eval`.
#
# TIMEZONE — READ THIS BEFORE TOUCHING THE DATE LOGIC:
#   scripts/run-log.sh writes RUN-LOG.jsonl timestamps in UTC (`date -u`).
#   The watchdog therefore matches FIRED against the UTC calendar date. If
#   it matched against Central Time instead, the early refresh routines
#   (refresh-market-earnings et al. fire ~04:32 UTC) would land on the
#   PRIOR CT day and be reported "missing" every single day. PERPLEXITY-LOG
#   rows, by contrast, are stamped in CT by perplexity.sh — so the
#   Perplexity tally matches against the CT calendar date. Two log files,
#   two timezone frames, on purpose.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck source=_lib.sh
source "$ROOT/scripts/_lib.sh"
_load_env "$ROOT"
_require_jq

# ─── args ───────────────────────────────────────────────────────────────
MODE="daily"
DATE_OVERRIDE=""
FORMAT="kv"
POST=0
for arg in "$@"; do
  case "$arg" in
    --mode=*)   MODE="${arg#--mode=}" ;;
    --date=*)   DATE_OVERRIDE="${arg#--date=}" ;;
    --format=*) FORMAT="${arg#--format=}" ;;
    --post)     POST=1 ;;
    *) echo "eod-health.sh: unknown arg '$arg'" >&2; exit 1 ;;
  esac
done
case "$MODE" in
  daily|refresh) ;;
  *) echo "eod-health.sh: --mode must be daily or refresh" >&2; exit 1 ;;
esac
case "$FORMAT" in
  kv|json) ;;
  *) echo "eod-health.sh: --format must be kv or json" >&2; exit 1 ;;
esac

if [[ -n "$DATE_OVERRIDE" ]]; then
  RUN_DATE="$DATE_OVERRIDE"
  CT_DATE="$DATE_OVERRIDE"
else
  RUN_DATE="$(date -u '+%Y-%m-%d')"
  CT_DATE="$(TZ=America/Chicago date '+%Y-%m-%d')"
fi

# ─── A. run-log watchdog ────────────────────────────────────────────────
# The expected routine set is fleet-wide — the same routines fire for every
# bot — so reading any one bot's RUN-LOG.jsonl is sufficient.
LOG="$(find "$ROOT"/memory -mindepth 3 -maxdepth 3 -name RUN-LOG.jsonl 2>/dev/null | sort | head -n 1)"

if [[ "$MODE" == "refresh" ]]; then
  # refresh-watchdog (Sat/Sun) only watches the 3 daily refresh routines.
  EXPECTED="refresh-market-earnings refresh-economic-events refresh-earnings-results"
else
  EXPECTED="auth-canary pre-market market-open mid-morning late-morning midday stops afternoon daily-summary refresh-market-earnings refresh-economic-events refresh-earnings-results"
  # weekly-review is expected on Fridays only. Day-of-week is taken in the
  # run-log's own (UTC) frame for consistency with the FIRED match below.
  dow="$(date -u -j -f '%Y-%m-%d' "$RUN_DATE" '+%u' 2>/dev/null \
      || date -u -d "$RUN_DATE" '+%u' 2>/dev/null || echo 0)"
  [[ "$dow" == "5" ]] && EXPECTED="$EXPECTED weekly-review"
fi

FIRED=""
if [[ -n "$LOG" ]]; then
  FIRED="$(jq -r --arg d "$RUN_DATE" \
    'select(.action == "end" and .status == "ok" and (.ts | startswith($d))) | .routine' \
    "$LOG" 2>/dev/null | sort -u)"
fi

MISSING=()
EXPECTED_COUNT=0
for r in $EXPECTED; do
  EXPECTED_COUNT=$((EXPECTED_COUNT + 1))
  if ! grep -qxF "$r" <<<"$FIRED"; then
    MISSING+=("$r")
  fi
done
FIRED_COUNT=$((EXPECTED_COUNT - ${#MISSING[@]}))

# comma-joined lists for output + Discord
missing_csv=""
if [[ ${#MISSING[@]} -gt 0 ]]; then
  missing_csv="$(IFS=,; echo "${MISSING[*]}")"
fi
fired_csv="$(echo "$FIRED" | grep -vxF '' | paste -sd, - 2>/dev/null || true)"

# ─── B. Perplexity tally (daily mode only) ──────────────────────────────
PERPLEXITY_COUNT=0
PERPLEXITY_COST="0.000000"
PERPLEXITY_MEDIAN=0

if [[ "$MODE" == "daily" ]]; then
  PPLX_LOG="$(shared_memory_dir "$ROOT")/PERPLEXITY-LOG.md"

  # Count + real-cost sum for today's CT-dated rows in one awk pass.
  # Row schema: `| <ts CT> | <model> | <query> | <cost> |` (4-col, current)
  # or legacy `| <ts CT> | <model> | <query> |` (3-col, pre-cost-column).
  # A proper 4-col row has >=5 pipes; legacy rows have 4. Legacy rows are
  # valued at the documented $0.0005 flat estimate. Cache-hit / error rows
  # already carry an explicit 0.0000 cost.
  read -r PERPLEXITY_COUNT PERPLEXITY_COST < <(
    awk -v d="$CT_DATE" '
      index($0, "| " d " ") == 1 {
        count++
        n = gsub(/\|/, "|")
        c = (n >= 5) ? $(NF - 1) : "0.0005"
        gsub(/[ \t]/, "", c)
        if (c !~ /^[0-9.]+$/) c = "0"
        sum += c
      }
      END { printf "%d %.6f\n", count + 0, sum + 0 }
    ' "$PPLX_LOG" 2>/dev/null
  )
  PERPLEXITY_COUNT="${PERPLEXITY_COUNT:-0}"
  PERPLEXITY_COST="${PERPLEXITY_COST:-0.000000}"

  # Rolling 14-day median of per-day call counts. `date -v-Nd` is BSD/macOS;
  # `date -d "N days ago"` is GNU/Linux — try both.
  PERPLEXITY_MEDIAN="$(
    for i in $(seq 1 14); do
      D="$(TZ=America/Chicago date -v -"${i}"d '+%Y-%m-%d' 2>/dev/null \
          || TZ=America/Chicago date -d "$i days ago" '+%Y-%m-%d' 2>/dev/null || echo '')"
      [[ -z "$D" ]] && { echo 0; continue; }
      grep -c "^| $D " "$PPLX_LOG" 2>/dev/null || echo 0
    done | sort -n | awk 'NR==7 {print; exit}'
  )"
  PERPLEXITY_MEDIAN="${PERPLEXITY_MEDIAN:-0}"
fi

# ─── --post: fire Discord posts (stdout-clean: route to stderr) ─────────
if [[ "$POST" == "1" ]]; then
  if [[ -n "$missing_csv" ]]; then
    if [[ "$MODE" == "refresh" ]]; then
      bash "$ROOT/scripts/discord.sh" --type=auth-canary "⚠️ Refresh watchdog — $RUN_DATE (weekend)

Missing refresh routines: $missing_csv
Fired refresh routines: ${fired_csv:-none}

Action: check the cloud Routines UI for the missing ones — Sat/Sun runs have no daily-summary watchdog so this catches silent no-ops." >&2
    else
      bash "$ROOT/scripts/discord.sh" --type=auth-canary "⚠️ Watchdog — $RUN_DATE

Missing routines: $missing_csv
Fired routines: ${fired_csv:-none}

Action: check the cloud Routines UI run logs for the missing ones." >&2
    fi
  fi
  if [[ "$MODE" == "daily" ]] && (( PERPLEXITY_COUNT > 2 * PERPLEXITY_MEDIAN )); then
    bash "$ROOT/scripts/discord.sh" --type=error "⚠️ Perplexity cost spike — $CT_DATE

Calls today: $PERPLEXITY_COUNT (~\$$PERPLEXITY_COST)
Rolling 14-day median: $PERPLEXITY_MEDIAN
Threshold: >2× median

Possible prompt regression — check today's RESEARCH-LOG and routine logs." >&2
  fi
fi

# ─── output ─────────────────────────────────────────────────────────────
# In `refresh` mode the Perplexity vars are omitted so refresh-watchdog's
# `eval` doesn't carry them into its shell — they aren't needed there.
if [[ "$FORMAT" == "json" ]]; then
  if [[ "$MODE" == "refresh" ]]; then
    jq -n \
      --arg mode "$MODE" --arg run_date "$RUN_DATE" --arg ct_date "$CT_DATE" \
      --argjson fired "$FIRED_COUNT" --argjson expected "$EXPECTED_COUNT" \
      --arg missing "$missing_csv" \
      '{mode:$mode, run_date:$run_date, ct_date:$ct_date,
        routines_fired:$fired, routines_expected:$expected,
        routines_missing:$missing}'
  else
    jq -n \
      --arg mode "$MODE" --arg run_date "$RUN_DATE" --arg ct_date "$CT_DATE" \
      --argjson fired "$FIRED_COUNT" --argjson expected "$EXPECTED_COUNT" \
      --arg missing "$missing_csv" \
      --argjson pplx_count "$PERPLEXITY_COUNT" \
      --arg pplx_cost "$PERPLEXITY_COST" \
      --argjson pplx_median "$PERPLEXITY_MEDIAN" \
      '{mode:$mode, run_date:$run_date, ct_date:$ct_date,
        routines_fired:$fired, routines_expected:$expected,
        routines_missing:$missing,
        perplexity_count:$pplx_count, perplexity_cost:$pplx_cost,
        perplexity_median:$pplx_median}'
  fi
else
  echo "MODE=$MODE"
  echo "RUN_DATE=$RUN_DATE"
  echo "CT_DATE=$CT_DATE"
  echo "ROUTINES_FIRED=$FIRED_COUNT"
  echo "ROUTINES_EXPECTED=$EXPECTED_COUNT"
  echo "ROUTINES_MISSING='$missing_csv'"
  if [[ "$MODE" == "daily" ]]; then
    echo "PERPLEXITY_COUNT=$PERPLEXITY_COUNT"
    echo "PERPLEXITY_COST=$PERPLEXITY_COST"
    echo "PERPLEXITY_MEDIAN=$PERPLEXITY_MEDIAN"
  fi
fi
