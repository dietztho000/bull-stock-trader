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

describe("ensureBotStrategyMemory", () => {
  it("creates the per-bot strategy dir and seeds TRADING-STRATEGY.md from registry template", async () => {
    const result = await s.ensureBotStrategyMemory("paper", "default");
    expect(result.created).toContain("TRADING-STRATEGY.md");
    expect(result.created).toContain("RUN-LOG.jsonl");
    const ruleBook = await fs.readFile(
      path.join(tmpRoot, "memory/paper/default/TRADING-STRATEGY.md"),
      "utf8"
    );
    expect(ruleBook).toBe(baseSeed.strategies[0].ruleBookTemplate);
  });

  it("is idempotent — second call skips every file", async () => {
    await s.ensureBotStrategyMemory("paper", "default");
    const second = await s.ensureBotStrategyMemory("paper", "default");
    expect(second.created).toEqual([]);
    expect(second.skipped).toContain("TRADING-STRATEGY.md");
    expect(second.skipped).toContain("RUN-LOG.jsonl");
  });

  it("does not overwrite a customized rule book on subsequent calls", async () => {
    await s.ensureBotStrategyMemory("paper", "default");
    const ruleBookPath = path.join(tmpRoot, "memory/paper/default/TRADING-STRATEGY.md");
    await fs.writeFile(ruleBookPath, "# user-edited rules\n", "utf8");
    await s.ensureBotStrategyMemory("paper", "default");
    const after = await fs.readFile(ruleBookPath, "utf8");
    expect(after).toBe("# user-edited rules\n");
  });

  it("falls back to an empty rule book when slug isn't in the registry", async () => {
    const result = await s.ensureBotStrategyMemory("paper", "ghost-slug");
    expect(result.created).toContain("TRADING-STRATEGY.md");
    const ruleBook = await fs.readFile(
      path.join(tmpRoot, "memory/paper/ghost-slug/TRADING-STRATEGY.md"),
      "utf8"
    );
    expect(ruleBook).toBe("");
  });
});

describe("addBot wiring (Phase 3)", () => {
  async function createSecondAccount() {
    await s.saveSettings({
      accounts: [
        ...(await s.listAccounts()),
        {
          id: "live-main",
          label: "Live",
          mode: "live",
          endpoint: "https://api.alpaca.markets/v2",
          apiKeyEnc: "v1.iv.tag.ct",
          secretKeyEnc: "v1.iv.tag.ct",
          createdAt: "2026-05-08T00:00:00Z",
        },
      ],
    });
  }

  it("stamps strategyVersionAtAssign from the registry on creation", async () => {
    await createSecondAccount();
    await s.addBot({
      id: "live",
      name: "Live",
      accountId: "live-main",
      allocation: null,
      strategySlug: "default",
      enabled: false,
      sentinelTrips: [],
      createdAt: "2026-05-08T00:00:00Z",
    });
    const bots = await s.listBots();
    const live = bots.find((b) => b.id === "live");
    expect(live?.strategyVersionAtAssign).toBe(1);
  });

  it("seeds memory/<bot>/<slug>/TRADING-STRATEGY.md after persisting the bot", async () => {
    await createSecondAccount();
    await s.addBot({
      id: "live",
      name: "Live",
      accountId: "live-main",
      allocation: null,
      strategySlug: "default",
      enabled: false,
      sentinelTrips: [],
      createdAt: "2026-05-08T00:00:00Z",
    });
    const ruleBook = await fs.readFile(
      path.join(tmpRoot, "memory/live/default/TRADING-STRATEGY.md"),
      "utf8"
    );
    expect(ruleBook).toContain("Default rules");
  });
});

describe("updateBot wiring (Phase 3)", () => {
  it("re-stamps strategyVersionAtAssign + seeds memory when slug changes", async () => {
    // Add a second strategy so the existing paper bot has somewhere to switch to.
    await s.addStrategy({
      slug: "momentum-v1",
      name: "Momentum v1",
      description: "test",
      enabled: true,
      ruleBookTemplate: "# Momentum\n- buy strength",
      params: [],
    });
    await s.updateBot("paper", { strategySlug: "momentum-v1" });
    const bots = await s.listBots();
    const paper = bots.find((b) => b.id === "paper");
    expect(paper?.strategySlug).toBe("momentum-v1");
    expect(paper?.strategyVersionAtAssign).toBe(1);
    const ruleBook = await fs.readFile(
      path.join(tmpRoot, "memory/paper/momentum-v1/TRADING-STRATEGY.md"),
      "utf8"
    );
    expect(ruleBook).toContain("Momentum");
  });

  it("re-stamps strategyVersionAtAssign on every save (Phase 5: explicit save = ack)", async () => {
    // Bump the registry past the bot's stamped version, then save the
    // bot with no slug change. The stamp should refresh to the current
    // version — that's the mechanism that clears the drift badge.
    await s.updateStrategy("default", { description: "edited once" });
    await s.updateStrategy("default", { description: "edited twice" });
    const reg = (await s.listStrategies()).find((x) => x.slug === "default");
    expect(reg?.version).toBe(3);
    // The test seed mimics a pre-Phase-1 bot — strategyVersionAtAssign
    // is undefined until first save. After save, it picks up the
    // current registry version.
    const before = (await s.listBots()).find((b) => b.id === "paper");
    expect(before?.strategyVersionAtAssign).toBeUndefined();
    await s.updateBot("paper", { name: "Paper renamed" });
    const after = (await s.listBots()).find((b) => b.id === "paper");
    expect(after?.name).toBe("Paper renamed");
    expect(after?.strategyVersionAtAssign).toBe(3);
  });
});

describe("updateStrategy", () => {
  it("bumps version + updatedAt on a meaningful change", async () => {
    const before = await s.getStrategy("default");
    expect(before?.version).toBe(1);
    await s.updateStrategy("default", { description: "tighter sector cap" });
    const after = await s.getStrategy("default");
    expect(after?.version).toBe(2);
    expect(after?.description).toBe("tighter sector cap");
    expect(after?.updatedAt).not.toBe(before?.updatedAt);
  });

  it("is a no-op (no version bump) when patch values match current", async () => {
    const before = await s.getStrategy("default");
    await s.updateStrategy("default", {
      name: before!.name,
      description: before!.description,
      enabled: before!.enabled,
      ruleBookTemplate: before!.ruleBookTemplate,
      params: before!.params,
    });
    const after = await s.getStrategy("default");
    expect(after?.version).toBe(before?.version);
    expect(after?.updatedAt).toBe(before?.updatedAt);
  });

  it("rejects an update for a missing slug", async () => {
    await expect(
      s.updateStrategy("ghost", { name: "Ghost" })
    ).rejects.toThrow(/not found/i);
  });

  it("preserves other strategies when patching one", async () => {
    await s.addStrategy({
      slug: "extra",
      name: "Extra",
      description: "",
      enabled: true,
      ruleBookTemplate: "",
      params: [],
    });
    await s.updateStrategy("default", { description: "edited" });
    const all = await s.listStrategies();
    expect(all).toHaveLength(2);
    expect(all.find((x) => x.slug === "extra")?.version).toBe(1);
  });
});

describe("deleteStrategy", () => {
  it("rejects when any bot references the slug", async () => {
    // Default strategy is referenced by the seeded "paper" bot.
    await expect(s.deleteStrategy("default")).rejects.toThrow(/still reference/i);
  });

  it("succeeds when no bot references the slug", async () => {
    await s.addStrategy({
      slug: "orphan",
      name: "Orphan",
      description: "",
      enabled: true,
      ruleBookTemplate: "",
      params: [],
    });
    await s.deleteStrategy("orphan");
    const remaining = await s.listStrategies();
    expect(remaining.map((x) => x.slug)).not.toContain("orphan");
  });

  it("force=true bypasses the FK check", async () => {
    await s.deleteStrategy("default", { force: true });
    const remaining = await s.listStrategies();
    expect(remaining.map((x) => x.slug)).not.toContain("default");
  });

  it("rejects deletion of a missing slug", async () => {
    await expect(s.deleteStrategy("ghost")).rejects.toThrow(/not found/i);
  });
});
