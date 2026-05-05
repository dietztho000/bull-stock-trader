import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

let tmpRoot: string;
let originalCwd: string;
type ResearchModule = typeof import("../parsers/researchLog");
let mod: ResearchModule;
let logPath: string;

beforeAll(async () => {
  originalCwd = process.cwd();
  tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), "researchLog-test-"));
  await fs.mkdir(path.join(tmpRoot, "dashboard"), { recursive: true });
  await fs.mkdir(path.join(tmpRoot, "memory", "live", "default"), { recursive: true });
  process.chdir(path.join(tmpRoot, "dashboard"));
  logPath = path.join(tmpRoot, "memory", "live", "default", "RESEARCH-LOG.md");
  mod = await import("../parsers/researchLog");
});

afterAll(async () => {
  process.chdir(originalCwd);
  await fs.rm(tmpRoot, { recursive: true, force: true });
});

beforeEach(async () => {
  (globalThis as { __memoryReadCache?: Map<string, unknown> }).__memoryReadCache = new Map();
  await fs.rm(logPath, { force: true });
});

const ctx = { bot: "live", strategy: "default" };

describe("loadResearchLog", () => {
  it("returns [] for missing file", async () => {
    expect(await mod.loadResearchLog(ctx)).toEqual([]);
  });

  it("parses a single dated entry with ideas + decision", async () => {
    await fs.writeFile(
      logPath,
      [
        "## 2026-05-05 — Pre-market Research",
        "",
        "Macro: Fed minutes today.",
        "",
        "### Trade Ideas",
        "1. AAPL — strong product cycle",
        "2. MSFT — cloud beat",
        "3. NVDA — chip demand",
        "",
        "### Decision",
        "TRADE (AAPL)",
        "",
      ].join("\n")
    );

    const out = await mod.loadResearchLog(ctx);
    expect(out).toHaveLength(1);
    expect(out[0].date).toBe("2026-05-05");
    expect(out[0].decision).toMatch(/^TRADE/);
    expect(out[0].ideas).toHaveLength(3);
    expect(out[0].ideas[0]).toContain("AAPL");
  });

  it("returns entries newest-first", async () => {
    await fs.writeFile(
      logPath,
      [
        "## 2026-05-03 — Pre-market Research",
        "Body 3",
        "",
        "## 2026-05-05 — Research",
        "Body 5",
        "",
        "## 2026-05-04 — Pre-market Research",
        "Body 4",
        "",
      ].join("\n")
    );
    const out = await mod.loadResearchLog(ctx);
    expect(out.map((e) => e.date)).toEqual(["2026-05-05", "2026-05-04", "2026-05-03"]);
  });

  it("captures HOLD decisions verbatim", async () => {
    await fs.writeFile(
      logPath,
      [
        "## 2026-05-05 — Pre-market Research",
        "",
        "### Decision",
        "HOLD",
        "",
      ].join("\n")
    );
    const out = await mod.loadResearchLog(ctx);
    expect(out[0].decision).toBe("HOLD");
  });

  it("returns null decision when none present", async () => {
    await fs.writeFile(
      logPath,
      [
        "## 2026-05-05 — Pre-market Research",
        "",
        "Just a sentence with no structured decision.",
        "",
      ].join("\n")
    );
    const out = await mod.loadResearchLog(ctx);
    expect(out[0].decision).toBeNull();
  });

  it("returns empty ideas list when no Trade Ideas section", async () => {
    await fs.writeFile(
      logPath,
      [
        "## 2026-05-05 — Pre-market Research",
        "",
        "Some prose without a numbered list.",
        "",
      ].join("\n")
    );
    const out = await mod.loadResearchLog(ctx);
    expect(out[0].ideas).toEqual([]);
  });

  it("ignores headers that don't match the date pattern", async () => {
    await fs.writeFile(
      logPath,
      [
        "# Document title",
        "",
        "## Some other section",
        "",
        "## 2026-05-05 — Pre-market Research",
        "Body",
        "",
      ].join("\n")
    );
    const out = await mod.loadResearchLog(ctx);
    expect(out).toHaveLength(1);
    expect(out[0].date).toBe("2026-05-05");
  });

  it("does not bleed body content from one entry into the next", async () => {
    await fs.writeFile(
      logPath,
      [
        "## 2026-05-04 — Pre-market Research",
        "marker-day-4",
        "",
        "## 2026-05-05 — Pre-market Research",
        "marker-day-5",
        "",
      ].join("\n")
    );
    const out = await mod.loadResearchLog(ctx);
    const day5 = out.find((e) => e.date === "2026-05-05");
    const day4 = out.find((e) => e.date === "2026-05-04");
    expect(day5?.body).toContain("marker-day-5");
    expect(day5?.body).not.toContain("marker-day-4");
    expect(day4?.body).toContain("marker-day-4");
    expect(day4?.body).not.toContain("marker-day-5");
  });
});
