import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

let tmpRoot: string;
let originalCwd: string;
type ParserModule = typeof import("../parsers/marketEarnings");
let parser: ParserModule;

beforeAll(async () => {
  originalCwd = process.cwd();
  tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), "marketEarnings-test-"));
  await fs.mkdir(path.join(tmpRoot, "dashboard"), { recursive: true });
  await fs.mkdir(path.join(tmpRoot, "memory", "shared"), { recursive: true });
  process.chdir(path.join(tmpRoot, "dashboard"));
  parser = await import("../parsers/marketEarnings");
});

afterAll(async () => {
  process.chdir(originalCwd);
  await fs.rm(tmpRoot, { recursive: true, force: true });
});

beforeEach(() => {
  (
    globalThis as { __memoryReadCache?: Map<string, unknown> }
  ).__memoryReadCache = new Map();
});

const FILE = () => path.join(tmpRoot, "memory", "shared", "MARKET-EARNINGS.md");

describe("marketEarnings parser", () => {
  it("parses old-format rows (no trailing result columns)", async () => {
    await fs.writeFile(
      FILE(),
      `# Market Earnings

## Calendar
| Symbol | Company | Earnings Date | BMO/AMC | EPS Estimate | Source | Date refreshed |
|--------|---------|---------------|---------|--------------|--------|----------------|
| AAPL | Apple | 2026-05-08 | AMC | $1.49 | Perplexity | 2026-05-06 |
| MSFT | Microsoft | 2026-05-09 | BMO | $2.85 | Perplexity | 2026-05-06 |
`
    );
    const entries = await parser.loadMarketEarnings();
    expect(entries).toHaveLength(2);
    expect(entries[0]).toMatchObject({
      symbol: "AAPL",
      company: "Apple",
      type: "AMC",
      epsEstimate: "$1.49",
    });
    expect(entries[0].actualEps).toBeUndefined();
    expect(entries[0].postPrintMovePct).toBeUndefined();
  });

  it("parses new-format rows (with Actual EPS and 1-day move %)", async () => {
    await fs.writeFile(
      FILE(),
      `# Market Earnings

## Calendar
| Symbol | Company | Earnings Date | BMO/AMC | EPS Estimate | Source | Date refreshed | Actual EPS | 1-day move % |
|--------|---------|---------------|---------|--------------|--------|----------------|------------|--------------|
| AAPL | Apple | 2026-05-01 | AMC | $1.49 | Perplexity | 2026-05-06 | $1.51 | +2.3% |
| TSLA | Tesla | 2026-05-02 | BMO | $0.85 | Perplexity | 2026-05-06 | $0.79 | -4.1% |
`
    );
    const entries = await parser.loadMarketEarnings();
    expect(entries).toHaveLength(2);
    expect(entries.find((e) => e.symbol === "AAPL")).toMatchObject({
      actualEps: "$1.51",
      postPrintMovePct: "+2.3%",
    });
    expect(entries.find((e) => e.symbol === "TSLA")).toMatchObject({
      actualEps: "$0.79",
      postPrintMovePct: "-4.1%",
    });
  });

  it("handles partial result back-fill (actual without move)", async () => {
    await fs.writeFile(
      FILE(),
      `# Market Earnings

## Calendar
| Symbol | Company | Earnings Date | BMO/AMC | EPS Estimate | Source | Date refreshed | Actual EPS | 1-day move % |
|--------|---------|---------------|---------|--------------|--------|----------------|------------|--------------|
| GOOGL | Alphabet | 2026-05-05 | AMC | $1.95 | Perplexity | 2026-05-06 | $2.10 | |
`
    );
    const entries = await parser.loadMarketEarnings();
    expect(entries[0].actualEps).toBe("$2.10");
    expect(entries[0].postPrintMovePct).toBeUndefined();
  });
});
