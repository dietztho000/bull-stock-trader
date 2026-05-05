import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

let tmpRoot: string;
let originalCwd: string;
type DailySummaryModule = typeof import("../parsers/dailySummary");
let mod: DailySummaryModule;
let summaryPath: string;

beforeAll(async () => {
  originalCwd = process.cwd();
  tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), "dailySummary-test-"));
  await fs.mkdir(path.join(tmpRoot, "dashboard"), { recursive: true });
  await fs.mkdir(path.join(tmpRoot, "memory", "shared"), { recursive: true });
  process.chdir(path.join(tmpRoot, "dashboard"));
  summaryPath = path.join(tmpRoot, "memory", "shared", "DAILY-SUMMARY.md");
  // Re-import memoryPath fresh so dailySummary's transitive deps capture the
  // tmp ROOT. Doing this inside beforeAll keeps the imports lazy.
  mod = await import("../parsers/dailySummary");
});

afterAll(async () => {
  process.chdir(originalCwd);
  await fs.rm(tmpRoot, { recursive: true, force: true });
});

beforeEach(async () => {
  (globalThis as { __memoryReadCache?: Map<string, unknown> }).__memoryReadCache = new Map();
  await fs.rm(summaryPath, { force: true });
});

describe("loadDailySummaries", () => {
  it("returns [] when the file is missing", async () => {
    expect(await mod.loadDailySummaries()).toEqual([]);
  });

  it("parses a single dated section", async () => {
    await fs.writeFile(
      summaryPath,
      [
        "## 2026-05-05 — Daily Summary",
        "",
        "**Total portfolio:** $20,000",
        "Day P&L: +$200 (+1.0%)",
        "",
        "---",
      ].join("\n")
    );
    const out = await mod.loadDailySummaries();
    expect(out).toHaveLength(1);
    expect(out[0].date).toBe("2026-05-05");
    expect(out[0].body).toContain("Total portfolio");
  });

  it("returns sections sorted newest-first", async () => {
    await fs.writeFile(
      summaryPath,
      [
        "## 2026-05-04 — Daily Summary",
        "Day 1 body",
        "",
        "---",
        "## 2026-05-05 — Daily Summary",
        "Day 2 body",
        "",
        "---",
        "## 2026-05-03 — Daily Summary",
        "Day 0 body",
        "",
        "---",
      ].join("\n")
    );
    const out = await mod.loadDailySummaries();
    expect(out.map((s) => s.date)).toEqual(["2026-05-05", "2026-05-04", "2026-05-03"]);
  });

  it("ignores sections without an h2 header", async () => {
    await fs.writeFile(
      summaryPath,
      [
        "Some preamble paragraph without a header.",
        "",
        "---",
        "## 2026-05-05 — Daily Summary",
        "Body",
        "",
        "---",
      ].join("\n")
    );
    const out = await mod.loadDailySummaries();
    expect(out).toHaveLength(1);
    expect(out[0].date).toBe("2026-05-05");
  });
});
