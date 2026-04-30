import type { ClosedTrade } from "../parsers/sectorLedger";
import type { TradeEntry } from "../parsers/tradeLog";

// R-multiple = (exit - entry) / |entry - stop|
// Needs the stop level from TRADE-LOG entries, joined by ticker+date.

export type RMultiple = {
  symbol: string;
  date: string;
  r: number;
  pnl: number;
};

export function rMultiples(
  closed: ClosedTrade[],
  entries: TradeEntry[]
): RMultiple[] {
  const out: RMultiple[] = [];
  for (const t of closed) {
    if (t.entry == null || t.exit == null) continue;
    const stop = entries.find(
      (e) => e.ticker === t.symbol && (!e.date || e.date <= t.date)
    )?.stop;
    if (stop == null) continue;
    const risk = Math.abs(t.entry - stop);
    if (risk === 0) continue;
    const r = (t.exit - t.entry) / risk;
    out.push({ symbol: t.symbol, date: t.date, r, pnl: t.pnl ?? 0 });
  }
  return out;
}

export function avgR(rs: RMultiple[]): number | null {
  if (!rs.length) return null;
  return rs.reduce((a, r) => a + r.r, 0) / rs.length;
}
