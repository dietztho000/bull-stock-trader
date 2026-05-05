import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { daysUntilEarnings } from "../parsers/earningsCalendar.shared";

let tmpRoot: string;
let originalCwd: string;
type EarningsModule = typeof import("../parsers/earningsCalendar");
let mod: EarningsModule;
let logPath: string;

beforeAll(async () => {
  originalCwd = process.cwd();
  tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), "earnings-test-"));
  await fs.mkdir(path.join(tmpRoot, "dashboard"), { recursive: true });
  await fs.mkdir(path.join(tmpRoot, "memory", "live", "default"), { recursive: true });
  process.chdir(path.join(tmpRoot, "dashboard"));
  logPath = path.join(tmpRoot, "memory", "live", "default", "EARNINGS-CALENDAR.md");
  mod = await import("../parsers/earningsCalendar");
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

describe("loadEarningsCalendar", () => {
  it("returns empty Map for missing file", async () => {
    const out = await mod.loadEarningsCalendar(ctx);
    expect(out.size).toBe(0);
  });

  it("indexes entries by uppercased symbol", async () => {
    await fs.writeFile(
      logPath,
      [
        "## Calendar",
        "",
        "| Symbol | Next Earnings Date | BMO/AMC | Source | Date refreshed |",
        "|--------|--------------------|---------|--------|----------------|",
        "| aapl | 2026-05-15 | AMC | perplexity | 2026-05-05 |",
        "| msft | 2026-05-22 | BMO | perplexity | 2026-05-05 |",
        "",
      ].join("\n")
    );
    const out = await mod.loadEarningsCalendar(ctx);
    expect(out.size).toBe(2);
    expect(out.get("AAPL")?.date).toBe("2026-05-15");
    expect(out.get("AAPL")?.type).toBe("AMC");
    expect(out.get("MSFT")?.type).toBe("BMO");
  });

  it("normalizes BMO/AMC to empty string when value is bogus", async () => {
    await fs.writeFile(
      logPath,
      [
        "## Calendar",
        "",
        "| Symbol | Next Earnings Date | BMO/AMC | Source | Date refreshed |",
        "|--------|--------------------|---------|--------|----------------|",
        "| AAPL | 2026-05-15 | sometime | perplexity | 2026-05-05 |",
        "",
      ].join("\n")
    );
    const out = await mod.loadEarningsCalendar(ctx);
    expect(out.get("AAPL")?.type).toBe("");
  });

  it("filters out placeholder rows like _none_", async () => {
    await fs.writeFile(
      logPath,
      [
        "## Calendar",
        "",
        "| Symbol | Next Earnings Date | BMO/AMC | Source | Date refreshed |",
        "|--------|--------------------|---------|--------|----------------|",
        "| _none_ | _none_ | _none_ | _none_ | _none_ |",
        "",
      ].join("\n")
    );
    const out = await mod.loadEarningsCalendar(ctx);
    expect(out.size).toBe(0);
  });
});

describe("daysUntilEarnings", () => {
  // Anchor today to noon-local to avoid DST flake at midnight rollovers.
  const today = new Date(2026, 4, 5, 12, 0, 0); // 2026-05-05 noon local

  it("returns null for empty / 'none' / malformed dates", () => {
    expect(daysUntilEarnings("", today)).toBeNull();
    expect(daysUntilEarnings("none", today)).toBeNull();
    expect(daysUntilEarnings("not-a-date", today)).toBeNull();
  });

  it("returns 0 when earnings are today", () => {
    expect(daysUntilEarnings("2026-05-05", today)).toBe(0);
  });

  it("returns positive days when earnings are in the future", () => {
    expect(daysUntilEarnings("2026-05-08", today)).toBe(3);
    expect(daysUntilEarnings("2026-06-01", today)).toBe(27);
  });

  it("returns negative days when earnings have passed", () => {
    expect(daysUntilEarnings("2026-05-01", today)).toBe(-4);
  });
});
