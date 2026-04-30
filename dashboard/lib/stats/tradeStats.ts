import type { ClosedTrade } from "../parsers/sectorLedger";

export type TradeStats = {
  total: number;
  wins: number;
  losses: number;
  breakeven: number;
  winRate: number; // 0..1
  totalPnl: number;
  avgWin: number;
  avgLoss: number; // absolute (positive number)
  profitFactor: number | null;
  payoffRatio: number | null;
  expectancy: number; // dollars per trade
  best: ClosedTrade | null;
  worst: ClosedTrade | null;
  longestWinStreak: number;
  longestLossStreak: number;
};

export function computeTradeStats(closed: ClosedTrade[]): TradeStats {
  const wins = closed.filter((t) => t.outcome === "W");
  const losses = closed.filter((t) => t.outcome === "L");
  const breakeven = closed.filter((t) => t.outcome === "B");

  const sumWins = wins.reduce((a, t) => a + (t.pnl ?? 0), 0);
  const sumLosses = losses.reduce((a, t) => a + (t.pnl ?? 0), 0); // negative
  const totalPnl = closed.reduce((a, t) => a + (t.pnl ?? 0), 0);

  const avgWin = wins.length ? sumWins / wins.length : 0;
  const avgLoss = losses.length ? Math.abs(sumLosses / losses.length) : 0;

  const profitFactor =
    sumLosses < 0 ? sumWins / Math.abs(sumLosses) : sumWins > 0 ? Infinity : null;

  const winRate = closed.length
    ? wins.length / (wins.length + losses.length || 1)
    : 0;

  const expectancy = winRate * avgWin - (1 - winRate) * avgLoss;

  let best: ClosedTrade | null = null;
  let worst: ClosedTrade | null = null;
  for (const t of closed) {
    if (t.pnl == null) continue;
    if (!best || (best.pnl ?? -Infinity) < t.pnl) best = t;
    if (!worst || (worst.pnl ?? Infinity) > t.pnl) worst = t;
  }

  let longestWin = 0,
    longestLoss = 0,
    runWin = 0,
    runLoss = 0;
  for (const t of closed) {
    if (t.outcome === "W") {
      runWin += 1;
      runLoss = 0;
      longestWin = Math.max(longestWin, runWin);
    } else if (t.outcome === "L") {
      runLoss += 1;
      runWin = 0;
      longestLoss = Math.max(longestLoss, runLoss);
    } else {
      runWin = 0;
      runLoss = 0;
    }
  }

  return {
    total: closed.length,
    wins: wins.length,
    losses: losses.length,
    breakeven: breakeven.length,
    winRate,
    totalPnl,
    avgWin,
    avgLoss,
    profitFactor,
    payoffRatio: avgLoss > 0 ? avgWin / avgLoss : null,
    expectancy,
    best,
    worst,
    longestWinStreak: longestWin,
    longestLossStreak: longestLoss,
  };
}

export function bySector(closed: ClosedTrade[]) {
  const map = new Map<string, ClosedTrade[]>();
  for (const t of closed) {
    const list = map.get(t.sector) ?? [];
    list.push(t);
    map.set(t.sector, list);
  }
  return Array.from(map.entries()).map(([sector, trades]) => ({
    sector,
    stats: computeTradeStats(trades),
    trades,
  }));
}
