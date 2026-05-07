import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

let tmpRoot: string;
let originalCwd: string;
type WatchlistModule = typeof import("../parsers/watchlist");
let wl: WatchlistModule;

beforeAll(async () => {
  originalCwd = process.cwd();
  tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), "watchlist-test-"));
  await fs.mkdir(path.join(tmpRoot, "dashboard"), { recursive: true });
  await fs.mkdir(path.join(tmpRoot, "memory", "shared"), { recursive: true });
  process.chdir(path.join(tmpRoot, "dashboard"));
  // Import AFTER chdir so memoryPath captures the tmp root.
  wl = await import("../parsers/watchlist");
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

describe("watchlist parser + writer", () => {
  it("returns empty list when file is missing", async () => {
    const entries = await wl.loadWatchlist();
    expect(entries).toEqual([]);
  });

  it("addToWatchlist creates the file and adds a sorted entry", async () => {
    const result = await wl.addToWatchlist("aapl", "earnings play");
    expect(result.added).toBe(true);
    expect(result.entry.symbol).toBe("AAPL");
    expect(result.entry.note).toBe("earnings play");

    const entries = await wl.loadWatchlist();
    expect(entries).toHaveLength(1);
    expect(entries[0].symbol).toBe("AAPL");
  });

  it("addToWatchlist is idempotent — same symbol returns added=false", async () => {
    await wl.addToWatchlist("MSFT");
    const second = await wl.addToWatchlist("msft");
    expect(second.added).toBe(false);
    expect(second.entry.symbol).toBe("MSFT");

    const entries = await wl.loadWatchlist();
    expect(entries.filter((e) => e.symbol === "MSFT")).toHaveLength(1);
  });

  it("removeFromWatchlist removes an entry; second call is no-op", async () => {
    await wl.addToWatchlist("NVDA");
    const r1 = await wl.removeFromWatchlist("nvda");
    expect(r1.removed).toBe(true);
    const r2 = await wl.removeFromWatchlist("NVDA");
    expect(r2.removed).toBe(false);
  });

  it("rejects invalid symbols", async () => {
    await expect(wl.addToWatchlist("not a ticker")).rejects.toThrow(/invalid/);
    await expect(wl.addToWatchlist("")).rejects.toThrow(/invalid/);
  });

  it("entries are sorted alphabetically", async () => {
    await wl.addToWatchlist("ZZZ");
    await wl.addToWatchlist("AAA");
    await wl.addToWatchlist("MMM");
    const entries = await wl.loadWatchlist();
    expect(entries.map((e) => e.symbol)).toEqual(["AAA", "AAPL", "MMM", "MSFT", "ZZZ"]);
  });

  it("loadWatchlistSymbols returns a Set", async () => {
    const set = await wl.loadWatchlistSymbols();
    expect(set.has("AAPL")).toBe(true);
    expect(set.has("ZZZ")).toBe(true);
    expect(set.has("XXX")).toBe(false);
  });
});
