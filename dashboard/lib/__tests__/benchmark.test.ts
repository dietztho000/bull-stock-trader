import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

let tmpRoot: string;
let originalCwd: string;
type BenchmarkModule = typeof import("../parsers/benchmark");
let mod: BenchmarkModule;
let logPath: string;

beforeAll(async () => {
  originalCwd = process.cwd();
  tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), "benchmark-test-"));
  await fs.mkdir(path.join(tmpRoot, "dashboard"), { recursive: true });
  await fs.mkdir(path.join(tmpRoot, "memory", "live", "default"), { recursive: true });
  process.chdir(path.join(tmpRoot, "dashboard"));
  logPath = path.join(tmpRoot, "memory", "live", "default", "BENCHMARK.md");
  mod = await import("../parsers/benchmark");
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

describe("loadBenchmark", () => {
  it("returns nulls and [] for missing file", async () => {
    const out = await mod.loadBenchmark(ctx);
    expect(out).toEqual({ phaseStart: null, startingEquity: null, rows: [] });
  });

  it("extracts phase start and starting equity from the preamble", async () => {
    await fs.writeFile(
      logPath,
      [
        "# Benchmark",
        "",
        "Phase start: 2026-04-29",
        "Starting equity: $10,000",
        "",
        "## Daily rows",
        "",
        "| Date | Portfolio | Day % | Phase % | SPY close | SPY day % | SPY phase % | Alpha day | Alpha phase |",
        "|------|-----------|-------|---------|-----------|-----------|-------------|-----------|-------------|",
        "| 2026-04-29 | $10,000 | 0.0% | 0.0% | $500 | 0.0% | 0.0% | 0.0% | 0.0% |",
        "",
      ].join("\n")
    );
    const out = await mod.loadBenchmark(ctx);
    expect(out.phaseStart).toBe("2026-04-29");
    expect(out.startingEquity).toBe(10000);
  });

  it("parses each daily row with portfolio + percentage fields", async () => {
    await fs.writeFile(
      logPath,
      [
        "Phase start: 2026-04-29",
        "Starting equity: $10,000",
        "",
        "## Daily rows",
        "",
        "| Date | Portfolio | Day % | Phase % | SPY close | SPY day % | SPY phase % | Alpha day | Alpha phase |",
        "|------|-----------|-------|---------|-----------|-----------|-------------|-----------|-------------|",
        "| 2026-04-30 | $10,150 | +1.5% | +1.5% | $505 | +1.0% | +1.0% | +0.5% | +0.5% |",
        "| 2026-05-01 | $10,000 | -1.5% | 0.0% | $510 | +1.0% | +2.0% | -2.5% | -2.0% |",
        "",
      ].join("\n")
    );
    const out = await mod.loadBenchmark(ctx);
    expect(out.rows).toHaveLength(2);
    const day0 = out.rows.find((r) => r.date === "2026-04-30");
    expect(day0?.portfolio).toBe(10150);
    expect(day0?.dayPct).toBeCloseTo(1.5, 1);
    expect(day0?.spyDayPct).toBeCloseTo(1.0, 1);
    expect(day0?.alphaDay).toBeCloseTo(0.5, 1);
    const day1 = out.rows.find((r) => r.date === "2026-05-01");
    expect(day1?.dayPct).toBeCloseTo(-1.5, 1);
    expect(day1?.alphaDay).toBeCloseTo(-2.5, 1);
  });

  it("sorts rows by date ascending regardless of file order", async () => {
    await fs.writeFile(
      logPath,
      [
        "Phase start: 2026-04-29",
        "Starting equity: $10,000",
        "",
        "## Daily rows",
        "",
        "| Date | Portfolio | Day % | Phase % | SPY close | SPY day % | SPY phase % | Alpha day | Alpha phase |",
        "|------|-----------|-------|---------|-----------|-----------|-------------|-----------|-------------|",
        "| 2026-05-03 | $1 | 0% | 0% | $1 | 0% | 0% | 0% | 0% |",
        "| 2026-05-01 | $1 | 0% | 0% | $1 | 0% | 0% | 0% | 0% |",
        "| 2026-05-02 | $1 | 0% | 0% | $1 | 0% | 0% | 0% | 0% |",
        "",
      ].join("\n")
    );
    const out = await mod.loadBenchmark(ctx);
    expect(out.rows.map((r) => r.date)).toEqual(["2026-05-01", "2026-05-02", "2026-05-03"]);
  });

  it("strips markdown formatting from phaseStart", async () => {
    await fs.writeFile(
      logPath,
      [
        "Phase start: **2026-04-29**",
        "Starting equity: $10,000",
        "",
      ].join("\n")
    );
    const out = await mod.loadBenchmark(ctx);
    expect(out.phaseStart).toBe("2026-04-29");
  });

  it("filters out placeholder rows", async () => {
    await fs.writeFile(
      logPath,
      [
        "## Daily rows",
        "",
        "| Date | Portfolio | Day % | Phase % | SPY close | SPY day % | SPY phase % | Alpha day | Alpha phase |",
        "|------|-----------|-------|---------|-----------|-----------|-------------|-----------|-------------|",
        "| _none_ | _none_ | _none_ | _none_ | _none_ | _none_ | _none_ | _none_ | _none_ |",
        "",
      ].join("\n")
    );
    const out = await mod.loadBenchmark(ctx);
    expect(out.rows).toEqual([]);
  });
});
