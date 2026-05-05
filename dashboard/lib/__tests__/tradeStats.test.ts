import { afterEach, describe, expect, it } from "vitest";
import { computeTradeStats } from "../stats/tradeStats";
import type { ClosedTrade } from "../parsers/sectorLedger";

function trade(overrides: Partial<ClosedTrade>): ClosedTrade {
  return {
    date: "2026-05-01",
    symbol: "AAPL",
    sector: "Technology",
    side: "buy",
    entry: 100,
    exit: 110,
    pnl: 100,
    pnlPct: 10,
    outcome: "W",
    notes: "",
    ...overrides,
  };
}

afterEach(() => {
  // Clear the cross-test cache so cases don't bleed into each other.
  (globalThis as { __tradeStatsCache?: unknown }).__tradeStatsCache = null;
});

describe("computeTradeStats", () => {
  it("returns zeros for an empty ledger", () => {
    const s = computeTradeStats([]);
    expect(s.total).toBe(0);
    expect(s.wins).toBe(0);
    expect(s.losses).toBe(0);
    expect(s.winRate).toBe(0);
    expect(s.totalPnl).toBe(0);
  });

  it("computes win/loss/breakeven counts and rates", () => {
    const trades: ClosedTrade[] = [
      trade({ outcome: "W", pnl: 100 }),
      trade({ outcome: "W", pnl: 50 }),
      trade({ outcome: "L", pnl: -75 }),
      trade({ outcome: "B", pnl: 0 }),
    ];
    const s = computeTradeStats(trades);
    expect(s.total).toBe(4);
    expect(s.wins).toBe(2);
    expect(s.losses).toBe(1);
    expect(s.breakeven).toBe(1);
    // win rate excludes breakeven from the denominator
    expect(s.winRate).toBeCloseTo(2 / 3, 5);
    expect(s.totalPnl).toBe(75);
  });

  it("computes profit factor as sumWins / abs(sumLosses)", () => {
    const trades: ClosedTrade[] = [
      trade({ outcome: "W", pnl: 200 }),
      trade({ outcome: "L", pnl: -50 }),
    ];
    const s = computeTradeStats(trades);
    expect(s.profitFactor).toBe(4);
  });

  it("returns Infinity profit factor when no losses", () => {
    const trades: ClosedTrade[] = [trade({ outcome: "W", pnl: 100 })];
    const s = computeTradeStats(trades);
    expect(s.profitFactor).toBe(Infinity);
  });

  it("tracks longest win and loss streaks separately", () => {
    const trades: ClosedTrade[] = [
      trade({ outcome: "W" }),
      trade({ outcome: "W" }),
      trade({ outcome: "W" }),
      trade({ outcome: "L" }),
      trade({ outcome: "L" }),
      trade({ outcome: "W" }),
    ];
    const s = computeTradeStats(trades);
    expect(s.longestWinStreak).toBe(3);
    expect(s.longestLossStreak).toBe(2);
  });
});

describe("computeTradeStats hash cache", () => {
  it("returns the same reference when input is structurally unchanged", () => {
    const trades: ClosedTrade[] = [
      trade({ symbol: "AAPL", date: "2026-05-01", pnl: 10 }),
      trade({ symbol: "MSFT", date: "2026-05-02", pnl: 20 }),
    ];
    const a = computeTradeStats(trades);
    const b = computeTradeStats(trades);
    expect(b).toBe(a); // same reference — hit the cache
  });

  it("recomputes when a trade is appended", () => {
    const t1 = trade({ symbol: "AAPL", date: "2026-05-01", pnl: 10 });
    const t2 = trade({ symbol: "MSFT", date: "2026-05-02", pnl: 20 });
    const a = computeTradeStats([t1]);
    const b = computeTradeStats([t1, t2]);
    expect(b).not.toBe(a);
    expect(b.total).toBe(2);
  });

  it("recomputes when a trade's pnl changes (totalPnl checksum bumps)", () => {
    const a = computeTradeStats([trade({ symbol: "AAPL", date: "2026-05-01", pnl: 10 })]);
    const b = computeTradeStats([trade({ symbol: "AAPL", date: "2026-05-01", pnl: 25 })]);
    expect(b).not.toBe(a);
    expect(b.totalPnl).toBe(25);
  });
});
