#!/usr/bin/env node
/**
 * One-shot bootstrap for Phase 1 of the multi-strategy upgrade.
 *
 * Reads the existing per-bot rule book at
 * `memory/paper/default/TRADING-STRATEGY.md` and the global thresholds
 * from `dashboard-settings.json` (the legacy singular-`strategy` section),
 * then writes a "default" entry into the new plural-`strategies` registry
 * with `ruleBookTemplate` + typed knobs mirrored from those values.
 *
 * Idempotent: re-running refreshes `ruleBookTemplate` from disk and bumps
 * `version` if any field actually changed. Safe to commit and re-run on
 * every clone.
 *
 * Usage:
 *   node dashboard/scripts/seed-default-strategy.mjs
 *
 * The script writes raw JSON; the dashboard's Zod schema validates the
 * file on next read. If the seed produces an invalid shape, the test
 * suite (`pnpm test`) will surface it immediately.
 */

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "../..");
const SETTINGS_FILE = path.join(REPO_ROOT, "memory/shared/dashboard-settings.json");
const RULE_BOOK_FILE = path.join(REPO_ROOT, "memory/paper/default/TRADING-STRATEGY.md");

const DEFAULT_SLUG = "default";
const DEFAULT_NAME = "Default";
const DEFAULT_DESCRIPTION =
  "Original rule-based qualitative-rubric strategy. Conviction-weighted sizing, sector-momentum entries, fixed -7% stop-limit at entry promoted to a 10% trailing stop once green.";

function buildParams(globalStrategy) {
  const g = globalStrategy ?? {};
  return [
    {
      kind: "number",
      key: "SECTOR_CAP",
      label: "Max open positions per GICS sector",
      value: g.sectorCap ?? 3,
      min: 1,
      max: 10,
      step: 1,
    },
    {
      kind: "number",
      key: "MAX_OPEN_POSITIONS",
      label: "Max open positions (account-wide)",
      value: g.maxOpenPositions ?? 6,
      min: 1,
      max: 20,
      step: 1,
    },
    {
      kind: "percent",
      key: "DAY_BREAKER_PCT",
      label: "Day P&L circuit breaker (no new entries below)",
      value: g.dayBreakerPct ?? -2,
      min: -20,
      max: 0,
    },
    {
      kind: "percent",
      key: "WEEK_BREAKER_PCT",
      label: "Week P&L circuit breaker (no new entries below)",
      value: g.weekBreakerPct ?? -4,
      min: -30,
      max: 0,
    },
    {
      kind: "number",
      key: "EARNINGS_GATE_DAYS",
      label: "Earnings blackout window (trading days)",
      value: g.earningsGateDays ?? 2,
      min: 0,
      max: 10,
      step: 1,
    },
    {
      kind: "number",
      key: "ENTRY_SCORE_MIN",
      label: "Entry scorer floor (out of 10)",
      value: g.entryScoreMin ?? 7,
      min: 0,
      max: 10,
      step: 1,
    },
    {
      kind: "percent",
      key: "TARGET_DEPLOYED_LOW_PCT",
      label: "Target capital deployed — low",
      value: g.targetDeployedLowPct ?? 75,
      min: 0,
      max: 100,
    },
    {
      kind: "percent",
      key: "TARGET_DEPLOYED_HIGH_PCT",
      label: "Target capital deployed — high",
      value: g.targetDeployedHighPct ?? 85,
      min: 0,
      max: 100,
    },
    {
      kind: "table",
      key: "CONVICTION_TABLE",
      label: "Entry score → position size %",
      rows: [
        { k: 7, v: 12 },
        { k: 8, v: 15 },
        { k: 9, v: 18 },
        { k: 10, v: 20 },
      ],
    },
  ];
}

function paramsEqual(a, b) {
  if (a === b) return true;
  if (a == null || b == null) return false;
  if (a.length !== b.length) return false;
  return JSON.stringify(a) === JSON.stringify(b);
}

async function main() {
  const [rawSettings, ruleBookTemplate] = await Promise.all([
    readFile(SETTINGS_FILE, "utf8"),
    readFile(RULE_BOOK_FILE, "utf8"),
  ]);
  const settings = JSON.parse(rawSettings);
  const strategies = Array.isArray(settings.strategies) ? settings.strategies : [];
  const existing = strategies.find((s) => s.slug === DEFAULT_SLUG);
  const params = buildParams(settings.strategy);
  const now = new Date().toISOString();
  const ruleBookChanged = !existing || existing.ruleBookTemplate !== ruleBookTemplate;
  const paramsChanged = !existing || !paramsEqual(existing.params, params);
  const descriptionChanged = !existing || existing.description !== DEFAULT_DESCRIPTION;
  const nameChanged = !existing || existing.name !== DEFAULT_NAME;
  const nothingChanged =
    existing && !ruleBookChanged && !paramsChanged && !descriptionChanged && !nameChanged;

  if (nothingChanged) {
    console.log(
      `✓ "${DEFAULT_SLUG}" strategy already up to date (version ${existing.version}, ${existing.params.length} params, ${ruleBookTemplate.length} bytes of rule book). No write.`
    );
    return;
  }

  const seed = {
    slug: DEFAULT_SLUG,
    name: DEFAULT_NAME,
    description: DEFAULT_DESCRIPTION,
    enabled: true,
    ruleBookTemplate,
    params,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    version: existing ? existing.version + 1 : 1,
  };
  const others = strategies.filter((s) => s.slug !== DEFAULT_SLUG);
  settings.strategies = [seed, ...others];
  await writeFile(SETTINGS_FILE, JSON.stringify(settings, null, 2) + "\n", "utf8");
  console.log(
    `✓ Seeded "${DEFAULT_SLUG}" strategy (version ${seed.version}, ${seed.params.length} params, ${ruleBookTemplate.length} bytes of rule book).`
  );
  console.log(
    `  Changes: ruleBook=${ruleBookChanged} params=${paramsChanged} description=${descriptionChanged} name=${nameChanged}`
  );
}

main().catch((err) => {
  console.error("seed-default-strategy failed:", err);
  process.exit(1);
});
