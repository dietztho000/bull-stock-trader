import type { ClosedTrade } from "@/lib/parsers/sectorLedger";

// Pure cooldown helpers. Mirror the bot's rule #20: a ticker stopped out
// (outcome `L`) within the last 3 trading days is blocked from re-entry
// unless a fresh dated catalyst exists in today's RESEARCH-LOG.
//
// Trading-day math is approximated via business-day counting (skip Sat/Sun).
// Holidays are not modeled — close enough for a UI badge; the bot's
// authoritative gate runs against live data, not this helper.

const COOLDOWN_TRADING_DAYS = 3;

export function tradingDaysBetween(fromIso: string, toIso: string): number {
  const from = parseIso(fromIso);
  const to = parseIso(toIso);
  if (!from || !to) return Number.POSITIVE_INFINITY;
  if (to <= from) return 0;
  let count = 0;
  const cur = new Date(from);
  cur.setDate(cur.getDate() + 1);
  while (cur <= to) {
    const dow = cur.getDay();
    if (dow !== 0 && dow !== 6) count++;
    cur.setDate(cur.getDate() + 1);
  }
  return count;
}

function parseIso(s: string): Date | null {
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export type CooldownStatus = {
  blocked: boolean;
  lastLossDate: string | null;
  daysSince: number | null;
  daysRemaining: number | null;
};

export function cooldownStatus(
  symbol: string,
  closedTrades: ClosedTrade[],
  today: string = todayIso()
): CooldownStatus {
  const sym = symbol.toUpperCase();
  // Most recent loss for this symbol.
  const losses = closedTrades
    .filter((t) => t.symbol.toUpperCase() === sym && t.outcome === "L")
    .sort((a, b) => b.date.localeCompare(a.date));
  const last = losses[0];
  if (!last || !last.date) {
    return { blocked: false, lastLossDate: null, daysSince: null, daysRemaining: null };
  }
  const daysSince = tradingDaysBetween(last.date, today);
  const remaining = Math.max(0, COOLDOWN_TRADING_DAYS - daysSince);
  return {
    blocked: daysSince < COOLDOWN_TRADING_DAYS,
    lastLossDate: last.date,
    daysSince,
    daysRemaining: remaining,
  };
}
