import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { StrategyDefinition } from "../settings.schema";

// settings.ts (and its dependency memoryPath.ts) compute their root paths
// from process.cwd() at module-load time. Set up a tmpdir tree + chdir
// BEFORE importing the module so file IO lands in the sandbox.
let tmpRoot: string;
let originalCwd: string;
type SettingsModule = typeof import("../settings");
let s: SettingsModule;

const SETTINGS_FILE_REL = "memory/shared/dashboard-settings.json";

const baseSeed = {
  accounts: [
    {
      id: "paper-main",
      label: "Paper",
      mode: "paper",
      endpoint: "https://paper-api.alpaca.markets/v2",
      apiKeyEnc: "v1.iv.tag.ct",
      secretKeyEnc: "v1.iv.tag.ct",
      createdAt: "2026-05-08T00:00:00Z",
    },
  ],
  bots: [
    {
      id: "paper",
      name: "Paper",
      accountId: "paper-main",
      allocation: null,
      strategySlug: "default",
      enabled: true,
      createdAt: "2026-05-08T00:00:00Z",
    },
  ],
  strategies: [
    {
      slug: "default",
      name: "Default",
      description: "",
      enabled: true,
      ruleBookTemplate: "# Default rules\n- Be disciplined.",
      params: [
        {
          kind: "number",
          key: "MAX_OPEN_POSITIONS",
          label: "Max open positions",
          value: 6,
          min: 1,
          max: 20,
          step: 1,
        },
      ],
      createdAt: "2026-05-08T00:00:00Z",
      updatedAt: "2026-05-08T00:00:00Z",
      version: 1,
    },
  ],
};

beforeAll(async () => {
  originalCwd = process.cwd();
  tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), "strategies-test-"));
  await fs.mkdir(path.join(tmpRoot, "dashboard"), { recursive: true });
  await fs.mkdir(path.join(tmpRoot, "memory", "shared"), { recursive: true });
  process.chdir(path.join(tmpRoot, "dashboard"));
  s = await import("../settings");
});

afterAll(async () => {
  process.chdir(originalCwd);
  await fs.rm(tmpRoot, { recursive: true, force: true });
});

beforeEach(async () => {
  // Reset the settings file + memory cache between tests.
  await fs.writeFile(
    path.join(tmpRoot, SETTINGS_FILE_REL),
    JSON.stringify(baseSeed, null, 2) + "\n",
    "utf8"
  );
  (globalThis as { __memoryReadCache?: Map<string, unknown> }).__memoryReadCache =
    new Map();
});

describe("listStrategies / getStrategy", () => {
  it("returns the seeded strategies from disk", async () => {
    const all = await s.listStrategies();
    expect(all).toHaveLength(1);
    expect(all[0].slug).toBe("default");
    expect(all[0].params[0].key).toBe("MAX_OPEN_POSITIONS");
  });

  it("getStrategy returns null for unknown slug", async () => {
    expect(await s.getStrategy("ghost")).toBeNull();
  });

  it("getStrategy returns the matching entry for known slug", async () => {
    const out = await s.getStrategy("default");
    expect(out).not.toBeNull();
    expect(out?.name).toBe("Default");
  });
});

describe("addStrategy", () => {
  it("appends a new strategy with version=1 and default timestamps", async () => {
    await s.addStrategy({
      slug: "momentum-v1",
      name: "Momentum v1",
      description: "Cloned from default with tighter sector cap",
      enabled: true,
      ruleBookTemplate: "# Momentum",
      params: [
        {
          kind: "percent",
          key: "DAY_BREAKER_PCT",
          label: "Day breaker",
          value: -3,
          min: -20,
          max: 0,
        },
      ],
    });
    const all = await s.listStrategies();
    expect(all.map((x) => x.slug).sort()).toEqual(["default", "momentum-v1"]);
    const m = all.find((x) => x.slug === "momentum-v1")!;
    expect(m.version).toBe(1);
    expect(m.params[0].kind).toBe("percent");
    expect(typeof m.createdAt).toBe("string");
    expect(typeof m.updatedAt).toBe("string");
  });

  it("rejects a duplicate slug", async () => {
    await expect(
      s.addStrategy({
        slug: "default",
        name: "Another",
        description: "",
        enabled: true,
        ruleBookTemplate: "",
        params: [],
      })
    ).rejects.toThrow(/already exists/i);
  });

  it("deep-clones table rows so caller-side mutation doesn't bleed into storage", async () => {
    const params = [
      {
        kind: "table" as const,
        key: "CONVICTION_TABLE",
        label: "Conviction → size",
        rows: [
          { k: 7, v: 12 },
          { k: 8, v: 15 },
        ],
      },
    ];
    await s.addStrategy({
      slug: "table-test",
      name: "Table",
      description: "",
      enabled: true,
      ruleBookTemplate: "",
      params,
    });
    // Mutate the caller's array AFTER the save — storage must not change.
    params[0].rows[0].v = 999;
    const stored = await s.getStrategy("table-test");
    if (!stored || stored.params[0].kind !== "table") throw new Error("missing");
    expect(stored.params[0].rows[0].v).toBe(12);
  });

  it("does not perturb unrelated sections (accounts, bots) on save", async () => {
    const before = await s.loadSettings();
    await s.addStrategy({
      slug: "extra",
      name: "Extra",
      description: "",
      enabled: true,
      ruleBookTemplate: "",
      params: [],
    });
    const after = await s.loadSettings();
    expect(after.accounts).toEqual(before.accounts);
    expect(after.bots).toEqual(before.bots);
  });
});

describe("assertReferentialIntegrity — strategy slug uniqueness", () => {
  it("saveSettings rejects a strategies array with duplicate slugs", async () => {
    const seeded = (await s.listStrategies())[0] as StrategyDefinition;
    await expect(
      s.saveSettings({
        strategies: [seeded, { ...seeded }],
      })
    ).rejects.toThrow(/Duplicate strategy slug/);
  });
});
