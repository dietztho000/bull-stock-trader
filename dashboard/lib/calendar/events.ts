import type { EarningsEntry } from "../parsers/earningsCalendar.shared";
import type { EconomicEvent } from "../parsers/economicCalendar.shared";

export type CalendarEvent =
  | { kind: "earnings"; date: string; entry: EarningsEntry }
  | { kind: "economic"; date: string; entry: EconomicEvent };

export type CalendarFilter = "all" | "earnings" | "economic";

/**
 * Combine the bot's per-ticker earnings cache with the broader market-earnings
 * list. When the same (symbol, date) appears in both, prefer the market entry
 * (richer fields: company, epsEstimate) and tag it `isHeld = true` so the UI
 * can highlight that the user has skin in the game.
 */
export function mergeEarnings(
  botCache: EarningsEntry[],
  market: EarningsEntry[]
): EarningsEntry[] {
  const heldKeys = new Set<string>();
  for (const e of botCache) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(e.date)) continue;
    heldKeys.add(`${e.symbol.toUpperCase()}::${e.date}`);
  }
  const out = new Map<string, EarningsEntry>();
  for (const e of botCache) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(e.date)) continue;
    const k = `${e.symbol.toUpperCase()}::${e.date}`;
    out.set(k, { ...e, isHeld: true });
  }
  for (const e of market) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(e.date)) continue;
    const k = `${e.symbol.toUpperCase()}::${e.date}`;
    const isHeld = heldKeys.has(k);
    const prev = out.get(k);
    // Market entry wins (richer data); preserve isHeld + carry over any extra
    // fields the bot cache had that market doesn't.
    out.set(k, {
      ...prev,
      ...e,
      isHeld,
    });
  }
  return Array.from(out.values()).sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    return a.symbol.localeCompare(b.symbol);
  });
}

export function mergeEvents(
  earnings: EarningsEntry[],
  economic: EconomicEvent[]
): CalendarEvent[] {
  const out: CalendarEvent[] = [];
  for (const e of earnings) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(e.date)) continue;
    out.push({ kind: "earnings", date: e.date, entry: e });
  }
  for (const e of economic) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(e.date)) continue;
    out.push({ kind: "economic", date: e.date, entry: e });
  }
  out.sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    if (a.kind !== b.kind) return a.kind === "earnings" ? -1 : 1;
    if (a.kind === "economic" && b.kind === "economic") {
      return a.entry.time.localeCompare(b.entry.time);
    }
    if (a.kind === "earnings" && b.kind === "earnings") {
      // Held positions sort first within a day, then by symbol.
      const ah = a.entry.isHeld ? 0 : 1;
      const bh = b.entry.isHeld ? 0 : 1;
      if (ah !== bh) return ah - bh;
      return a.entry.symbol.localeCompare(b.entry.symbol);
    }
    return 0;
  });
  return out;
}

export function filterEvents(
  events: CalendarEvent[],
  filter: CalendarFilter
): CalendarEvent[] {
  if (filter === "all") return events;
  return events.filter((e) => e.kind === filter);
}

export function eventsByDate(events: CalendarEvent[]): Map<string, CalendarEvent[]> {
  const m = new Map<string, CalendarEvent[]>();
  for (const e of events) {
    const arr = m.get(e.date);
    if (arr) arr.push(e);
    else m.set(e.date, [e]);
  }
  return m;
}

export function isoToday(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function addDaysIso(iso: string, days: number): string {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return iso;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function eventTitle(e: CalendarEvent): string {
  if (e.kind === "earnings") return e.entry.symbol;
  return e.entry.event;
}

export function isHighImpact(e: CalendarEvent): boolean {
  return e.kind === "economic" && e.entry.importance === "high";
}
