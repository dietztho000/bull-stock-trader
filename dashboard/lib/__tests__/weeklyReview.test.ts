import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

let tmpRoot: string;
let originalCwd: string;
type WeeklyReviewModule = typeof import("../parsers/weeklyReview");
let mod: WeeklyReviewModule;
let logPath: string;

beforeAll(async () => {
  originalCwd = process.cwd();
  tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), "weeklyReview-test-"));
  await fs.mkdir(path.join(tmpRoot, "dashboard"), { recursive: true });
  await fs.mkdir(path.join(tmpRoot, "memory", "live", "default"), { recursive: true });
  process.chdir(path.join(tmpRoot, "dashboard"));
  logPath = path.join(tmpRoot, "memory", "live", "default", "WEEKLY-REVIEW.md");
  mod = await import("../parsers/weeklyReview");
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

describe("loadWeeklyReviews", () => {
  it("returns [] for missing file", async () => {
    expect(await mod.loadWeeklyReviews(ctx)).toEqual([]);
  });

  it("parses one review with stats table and grade", async () => {
    await fs.writeFile(
      logPath,
      [
        "## Week ending 2026-05-08",
        "",
        "Solid week — all winners came from tech.",
        "",
        "### Stats",
        "",
        "| Metric | Value |",
        "|--------|-------|",
        "| Trades | 3 |",
        "| Win rate | 66.7% |",
        "| Alpha vs SPY | +1.2% |",
        "",
        "### Overall Grade: B+",
        "",
      ].join("\n")
    );

    const out = await mod.loadWeeklyReviews(ctx);
    expect(out).toHaveLength(1);
    expect(out[0].weekEnding).toBe("2026-05-08");
    expect(out[0].grade).toBe("B+");
    expect(out[0].stats).toEqual({
      Trades: "3",
      "Win rate": "66.7%",
      "Alpha vs SPY": "+1.2%",
    });
    expect(out[0].body).toContain("Solid week");
  });

  it("returns reviews sorted newest week-ending first", async () => {
    await fs.writeFile(
      logPath,
      [
        "## Week ending 2026-04-24",
        "Body 1",
        "",
        "## Week ending 2026-05-08",
        "Body 3",
        "",
        "## Week ending 2026-05-01",
        "Body 2",
        "",
      ].join("\n")
    );
    const out = await mod.loadWeeklyReviews(ctx);
    expect(out.map((r) => r.weekEnding)).toEqual([
      "2026-05-08",
      "2026-05-01",
      "2026-04-24",
    ]);
  });

  it("returns null grade when no Overall Grade line", async () => {
    await fs.writeFile(
      logPath,
      [
        "## Week ending 2026-05-08",
        "",
        "Forgot to fill in the grade.",
        "",
      ].join("\n")
    );
    const out = await mod.loadWeeklyReviews(ctx);
    expect(out[0].grade).toBeNull();
  });

  it("captures grade letters with +/- modifiers", async () => {
    await fs.writeFile(
      logPath,
      [
        "## Week ending 2026-05-08",
        "",
        "### Overall Grade: A-",
        "",
      ].join("\n")
    );
    const out = await mod.loadWeeklyReviews(ctx);
    expect(out[0].grade).toBe("A-");
  });

  it("handles a stats table with no rows beyond the separator", async () => {
    await fs.writeFile(
      logPath,
      [
        "## Week ending 2026-05-08",
        "",
        "### Stats",
        "",
        "| Metric | Value |",
        "|--------|-------|",
        "",
      ].join("\n")
    );
    const out = await mod.loadWeeklyReviews(ctx);
    expect(out[0].stats).toEqual({});
  });
});
