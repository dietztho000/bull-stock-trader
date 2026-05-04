#!/usr/bin/env bash
# Wires git to use the tracked .githooks/ directory. One-time setup so the
# pre-push round-trip check runs for everyone who clones the repo.
#
# Usage: bash scripts/install-githooks.sh

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

git config core.hooksPath .githooks
chmod +x .githooks/*

echo "Configured: git config core.hooksPath = .githooks"
echo "Active hooks:"
ls -1 .githooks | sed 's/^/  /'
