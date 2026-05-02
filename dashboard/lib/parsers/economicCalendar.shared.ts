// Pure types + helpers for the economic calendar — no Node `fs` imports so
// this module is safe for client components. Server-side loading lives in
// economicCalendar.ts (which re-exports from this file).

export type EconomicImportance = "high" | "medium" | "low" | "";

export type EconomicEvent = {
  date: string;
  time: string;
  event: string;
  importance: EconomicImportance;
  forecast: string;
  previous: string;
  source: string;
  refreshed: string;
};

export function daysUntilEvent(
  date: string,
  today: Date = new Date()
): number | null {
  const m = date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const target = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const t0 = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const ms = target.getTime() - t0.getTime();
  return Math.round(ms / 86_400_000);
}

export function normalizeImportance(raw: string): EconomicImportance {
  const v = raw.trim().toLowerCase();
  if (v === "high" || v === "medium" || v === "low") return v;
  return "";
}
