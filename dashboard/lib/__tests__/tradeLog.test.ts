import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

let tmpRoot: string;
let originalCwd: string;
type TradeLogModule = typeof import("../parsers/tradeLog");
let mod: TradeLogModule;
let logPath: string;

beforeAll(async () => {
  originalCwd = process.cwd();
  tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), "tradeLog-test-"));
  await fs.mkdir(path.join(tmpRoot, "dashboard"), { recursive: true });
  await fs.mkdir(path.join(tmpRoot, "memory", "live", "default"), { recursive: true });
  process.chdir(path.join(tmpRoot, "dashboard"));
  logPath = path.join(tmpRoot, "memory", "live", "default", "TRADE-LOG.md");
  mod = await import("../parsers/tradeLog");
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

const SAMPLE_SNAPSHOT = [
  "### Day 5 — EOD Snapshot — 2026-05-05 (Tuesday)",
  "**Portfolio:** $10,250 | **Cash:** $2,000 (19.5%) | **Day P&L:** +$150 (+1.5%) | **Phase P&L:** +$250 (+2.5%)",
  "**vs SPY:** day +0.3% | phase +0.5%",
  "| Ticker | Shares | Entry | Close | Day Chg | Unrealized P&L | Stop |",
  "|--------|-------|-------|-------|--------|----------------|------|",
  "| AAPL | 50 | $180.00 | $185.00 | +$5.00 | +$250 (+2.8%) | $167.40 |",
  "| MSFT | 25 | $400.00 | $402.00 | +$2.00 | +$50 (+0.5%) | $372.00 |",
  "**Notes:** Strong day on tech leadership.",
  "",
].join("\n");

describe("loadTradeLog — EOD snapshot parsing", () => {
  it("returns empty when no file", async () => {
    const out = await mod.loadTradeLog(ctx);
    expect(out.snapshots).toEqual([]);
    expect(out.entries).toEqual([]);
  });

  it("extracts the day, date, weekday from the header", async () => {
    await fs.writeFile(logPath, SAMPLE_SNAPSHOT);
    const out = await mod.loadTradeLog(ctx);
    expect(out.snapshots).toHaveLength(1);
    expect(out.snapshots[0].day).toBe(5);
    expect(out.snapshots[0].date).toBe("2026-05-05");
    expect(out.snapshots[0].weekday).toBe("Tuesday");
  });

  it("extracts portfolio, cash, day/phase P&L numbers", async () => {
    await fs.writeFile(logPath, SAMPLE_SNAPSHOT);
    const out = await mod.loadTradeLog(ctx);
    const s = out.snapshots[0];
    expect(s.portfolio).toBe(10250);
    expect(s.cash).toBe(2000);
    expect(s.cashPct).toBeCloseTo(19.5, 1);
    expect(s.dayPnl).toBe(150);
    expect(s.dayPct).toBeCloseTo(1.5, 1);
    expect(s.phasePnl).toBe(250);
    expect(s.phasePct).toBeCloseTo(2.5, 1);
  });

  it("extracts vs-SPY day and phase percentages", async () => {
    await fs.writeFile(logPath, SAMPLE_SNAPSHOT);
    const out = await mod.loadTradeLog(ctx);
    expect(out.snapshots[0].vsSpyDay).toBeCloseTo(0.3, 1);
    expect(out.snapshots[0].vsSpyPhase).toBeCloseTo(0.5, 1);
  });

  it("parses each row of the positions table with PnL + percent", async () => {
    await fs.writeFile(logPath, SAMPLE_SNAPSHOT);
    const out = await mod.loadTradeLog(ctx);
    const positions = out.snapshots[0].positions;
    expect(positions).toHaveLength(2);
    const aapl = positions.find((p) => p.ticker === "AAPL");
    expect(aapl?.shares).toBe(50);
    expect(aapl?.entry).toBe(180);
    expect(aapl?.close).toBe(185);
    expect(aapl?.unrealizedPnl).toBe(250);
    expect(aapl?.unrealizedPct).toBeCloseTo(2.8, 1);
    expect(aapl?.stop).toBe(167.4);
  });

  it("captures the notes paragraph after **Notes:**", async () => {
    await fs.writeFile(logPath, SAMPLE_SNAPSHOT);
    const out = await mod.loadTradeLog(ctx);
    expect(out.snapshots[0].notes).toContain("Strong day on tech leadership");
  });

  it("returns empty positions list when the table is missing", async () => {
    const noTable = [
      "### Day 1 — EOD Snapshot — 2026-05-01 (Friday)",
      "**Portfolio:** $10,000 | **Cash:** $10,000 (100%) | **Day P&L:** $0 (0.0%) | **Phase P&L:** $0 (0.0%)",
      "**vs SPY:** day 0.0% | phase 0.0%",
      "**Notes:** Flat first day.",
      "",
    ].join("\n");
    await fs.writeFile(logPath, noTable);
    const out = await mod.loadTradeLog(ctx);
    expect(out.snapshots[0].positions).toEqual([]);
    expect(out.snapshots[0].notes).toContain("Flat first day");
  });

  it("sorts multiple snapshots by day ascending", async () => {
    const snap1 = SAMPLE_SNAPSHOT.replace("Day 5", "Day 5").replace("2026-05-05", "2026-05-05");
    const snap2 = SAMPLE_SNAPSHOT
      .replace("### Day 5", "### Day 3")
      .replace("2026-05-05", "2026-05-03")
      .replace("(Tuesday)", "(Friday)");
    await fs.writeFile(logPath, [snap2, snap1].join("\n\n"));
    const out = await mod.loadTradeLog(ctx);
    expect(out.snapshots.map((s) => s.day)).toEqual([3, 5]);
  });
});

describe("loadTradeLog — entry parsing", () => {
  it("extracts ticker, side, entry, stop from the 6-line context above entry_scorer", async () => {
    // The parser's context window is 6 lines. The fixture must keep ticker
    // + key fields within that window.
    const content = [
      "Ticker: AAPL",
      "Side: buy",
      "Entry: $180.00",
      "Stop: $167.40",
      "Target: $200.00",
      "R:R: 1.5",
      'entry_scorer: {"catalyst":3,"momentum":2,"risk_reward":2,"stop_distance":1,"total":8}',
      "",
    ].join("\n");
    await fs.writeFile(logPath, content);

    const out = await mod.loadTradeLog(ctx);
    expect(out.entries).toHaveLength(1);
    const e = out.entries[0];
    expect(e.ticker).toBe("AAPL");
    expect(e.side).toBe("buy");
    expect(e.entry).toBe(180);
    expect(e.stop).toBe(167.4);
    expect(e.target).toBe(200);
    expect(e.rr).toBe(1.5);
    expect(e.scorer?.total).toBe(8);
  });

  it("nulls out scorer when entry_scorer line has invalid JSON in {} form", async () => {
    const content = [
      "Ticker: NVDA",
      "Side: buy",
      "Entry: $500",
      'entry_scorer: {"catalyst":3,bad json}',
      "",
    ].join("\n");
    await fs.writeFile(logPath, content);
    const out = await mod.loadTradeLog(ctx);
    expect(out.entries).toHaveLength(1);
    expect(out.entries[0].scorer).toBeNull();
    expect(out.entries[0].ticker).toBe("NVDA");
  });

  it("returns empty entries when no entry_scorer lines exist", async () => {
    await fs.writeFile(logPath, SAMPLE_SNAPSHOT);
    const out = await mod.loadTradeLog(ctx);
    expect(out.entries).toEqual([]);
  });
});
