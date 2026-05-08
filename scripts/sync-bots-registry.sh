#!/usr/bin/env bash
# Regenerates memory/shared/bots-registry.json from the dashboard's
# memory/shared/dashboard-settings.json. The registry file is the
# sanitized, committed projection of bots/accounts that cloud routines
# read in fresh clones (where dashboard-settings.json is gitignored).
#
# Run this after adding/editing bots in the dashboard, then commit the
# updated registry alongside any other changes. The pre-push hook runs
# this and fails the push if the regenerated file differs from what's
# committed — preventing local bot edits from silently failing in cloud.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SETTINGS="$ROOT/memory/shared/dashboard-settings.json"
REGISTRY="$ROOT/memory/shared/bots-registry.json"

if [[ ! -f "$SETTINGS" ]]; then
  echo "sync-bots-registry: dashboard-settings.json not found — nothing to sync" >&2
  exit 0
fi

# Project only the fields cloud-side bots.sh consumes. Strip apiKeyEnc,
# secretKeyEnc, label, endpoint, totalCapital, hardCapAllocation, createdAt,
# memoryAlias, name, discordWebhookUrl — none of those are referenced by
# bots.sh and most are either secrets (enc keys) or per-machine UI prefs.
#
# Strategies are projected too (Phase 4): cloud routines need each bot's
# typed params via `bots.sh list`'s 6th column, and the strategy rule
# book is what new-bot scaffolding seeds into per-bot memory. None of
# these fields are secret.
projected="$(jq '{
  _comment: "Cloud-side fallback for scripts/bots.sh when memory/shared/dashboard-settings.json is missing (fresh cloud clone). Regenerate via `bash scripts/sync-bots-registry.sh` after editing bots in the dashboard.",
  accounts: ((.accounts // []) | map({id, mode})),
  bots: ((.bots // []) | map({
    id,
    accountId,
    strategySlug: (.strategySlug // "default"),
    allocation,
    # jq `//` treats false like null, so `.enabled // true` would
    # silently re-enable a disabled bot. Default explicitly via `if`.
    enabled: (if .enabled == false then false else true end),
    routineFilter: (.routineFilter // null)
  })),
  strategies: ((.strategies // []) | map({
    slug,
    name,
    description,
    enabled,
    ruleBookTemplate,
    params,
    version
  }))
}' "$SETTINGS")"

# Atomic write so a concurrent `bots.sh` read can't see a half-written file.
tmp="$REGISTRY.tmp"
printf '%s\n' "$projected" > "$tmp"
mv "$tmp" "$REGISTRY"

echo "sync-bots-registry: wrote $REGISTRY ($(jq '.bots | length' "$REGISTRY") bots, $(jq '.accounts | length' "$REGISTRY") accounts)"
