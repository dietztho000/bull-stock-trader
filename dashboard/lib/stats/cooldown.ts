import type { ClosedTrade } from "@/lib/parsers/sectorLedger";
import { addDaysISO, dayOfWeekCT, todayInCT } from "@/lib/time";

// Pure cooldown helpers. Mirror the bot's rule #20: a ticker stopped out
// (outcome `L`) within the last 3 trading days is blocked from re-entry
// unless a fresh dated catalyst exists in today's RESEARCH-LOG.
//
// Trading-day math is approximated via business-day counting (skip Sat/Sun)
// in CT — `dayOfWeekCT` keeps the gate stable on non-CT hosts. Holidays are
// not modeled — close enough for a UI badge; the bot's authoritative gate
// runs against live data, not this helper.

const COOLDOWN_TRADING_DAYS = 3;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function dateOnly(s: string): string | null {
  const head = s.slice(0, 10);
  return ISO_DATE_RE.test(head) ? head : null;
}

export function tradingDaysBetween(fromIso: string, toIso: string): number {
  const from = dateOnly(fromIso);
  const to = dateOnly(toIso);
  if (!from || !to) return Number.POSITIVE_INFINITY;
  if (to <= from) return 0;
  let count = 0;
  let cur = addDaysISO(from, 1);
  while (cur <= to) {
    const dow = dayOfWeekCT(`${cur}T12:00:00Z`);
    if (dow !== 0 && dow !== 6) count++;
    cur = addDaysISO(cur, 1);
  }
  return count;
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
  today: string = todayInCT()
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
