import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

let tmpRoot: string;
let originalCwd: string;
type SectorLedgerModule = typeof import("../parsers/sectorLedger");
let mod: SectorLedgerModule;
let logPath: string;

beforeAll(async () => {
  originalCwd = process.cwd();
  tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), "sectorLedger-test-"));
  await fs.mkdir(path.join(tmpRoot, "dashboard"), { recursive: true });
  await fs.mkdir(path.join(tmpRoot, "memory", "live", "default"), { recursive: true });
  process.chdir(path.join(tmpRoot, "dashboard"));
  logPath = path.join(tmpRoot, "memory", "live", "default", "SECTOR-LEDGER.md");
  mod = await import("../parsers/sectorLedger");
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

describe("loadSectorLedger", () => {
  it("returns empty arrays for missing file", async () => {
    const out = await mod.loadSectorLedger(ctx);
    expect(out).toEqual({ closed: [], streaks: [] });
  });

  it("parses a Closed trades table with W/L outcomes", async () => {
    await fs.writeFile(
      logPath,
      [
        "## Closed trades",
        "",
        "| Date | Symbol | Sector | Side | Entry | Exit | P&L $ | P&L % | Outcome | Notes |",
        "|------|--------|--------|------|-------|------|-------|-------|---------|-------|",
        "| 2026-05-01 | AAPL | Technology | buy | $180.00 | $190.00 | +$500 | +5.5% | W | clean ride |",
        "| 2026-05-02 | TSLA | Consumer Discretionary | buy | $200.00 | $186.00 | -$700 | -7.0% | L | stop hit |",
        "",
      ].join("\n")
    );
    const out = await mod.loadSectorLedger(ctx);
    expect(out.closed).toHaveLength(2);
    const aapl = out.closed.find((t) => t.symbol === "AAPL");
    expect(aapl?.entry).toBe(180);
    expect(aapl?.exit).toBe(190);
    expect(aapl?.pnl).toBe(500);
    expect(aapl?.pnlPct).toBeCloseTo(5.5, 1);
    expect(aapl?.outcome).toBe("W");
    expect(aapl?.side).toBe("buy");
    const tsla = out.closed.find((t) => t.symbol === "TSLA");
    expect(tsla?.outcome).toBe("L");
    expect(tsla?.pnl).toBe(-700);
  });

  it("sorts closed trades by date ascending", async () => {
    await fs.writeFile(
      logPath,
      [
        "## Closed trades",
        "",
        "| Date | Symbol | Sector | Side | Entry | Exit | P&L $ | P&L % | Outcome | Notes |",
        "|------|--------|--------|------|-------|------|-------|-------|---------|-------|",
        "| 2026-05-03 | C | Tech | buy | $1 | $2 | +$1 | +1% | W |  |",
        "| 2026-05-01 | A | Tech | buy | $1 | $2 | +$1 | +1% | W |  |",
        "| 2026-05-02 | B | Tech | buy | $1 | $2 | +$1 | +1% | W |  |",
        "",
      ].join("\n")
    );
    const out = await mod.loadSectorLedger(ctx);
    expect(out.closed.map((t) => t.symbol)).toEqual(["A", "B", "C"]);
  });

  it("filters out placeholder rows like _none_", async () => {
    await fs.writeFile(
      logPath,
      [
        "## Closed trades",
        "",
        "| Date | Symbol | Sector | Side | Entry | Exit | P&L $ | P&L % | Outcome | Notes |",
        "|------|--------|--------|------|-------|------|-------|-------|---------|-------|",
        "| _none_ | _none_ | _none_ | _none_ | _none_ | _none_ | _none_ | _none_ | _none_ | _none_ |",
        "",
      ].join("\n")
    );
    const out = await mod.loadSectorLedger(ctx);
    expect(out.closed).toEqual([]);
  });

  it("parses a Streak tracker table with status normalization", async () => {
    await fs.writeFile(
      logPath,
      [
        "## Streak tracker",
        "",
        "| Sector | Last 2 outcomes | 30-day streak | Status |",
        "|--------|-----------------|---------------|--------|",
        "| Technology | W,W | 3W-0L | open |",
        "| Healthcare | L,L | 0W-2L | blocked |",
        "",
      ].join("\n")
    );
    const out = await mod.loadSectorLedger(ctx);
    expect(out.streaks).toHaveLength(2);
    expect(out.streaks[0].sector).toBe("Technology");
    expect(out.streaks[0].status).toBe("OPEN");
    expect(out.streaks[1].status).toBe("BLOCKED");
  });

  it("supports legacy column aliases (PnL $ → P&L $, Last 2 → Last 2 outcomes)", async () => {
    await fs.writeFile(
      logPath,
      [
        "## Closed trades",
        "",
        "| Date | Symbol | Sector | Side | Entry | Exit | PnL $ | PnL % | Outcome | Notes |",
        "|------|--------|--------|------|-------|------|-------|-------|---------|-------|",
        "| 2026-05-01 | AAPL | Tech | buy | $180 | $190 | +$500 | +5% | W |  |",
        "",
        "## Streak tracker",
        "",
        "| Sector | Last 2 | Streak | Status |",
        "|--------|--------|--------|--------|",
        "| Tech | W,W | 1W-0L | OPEN |",
      ].join("\n")
    );
    const out = await mod.loadSectorLedger(ctx);
    expect(out.closed[0].pnl).toBe(500);
    expect(out.closed[0].pnlPct).toBeCloseTo(5, 1);
    expect(out.streaks[0].lastTwo).toBe("W,W");
    expect(out.streaks[0].streak).toBe("1W-0L");
  });
});
