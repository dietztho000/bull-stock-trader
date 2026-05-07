// Pure types + helpers for the earnings calendar — no Node `fs` imports so
// this module is safe for client components. Server-side loading lives in
// earningsCalendar.ts (which re-exports from this file).

export type EarningsEntry = {
  symbol: string;
  date: string;
  type: "BMO" | "AMC" | "";
  source: string;
  refreshed: string;
  // Optional fields populated only by MARKET-EARNINGS.md (the broader
  // market-view list). Bot-cache entries (EARNINGS-CALENDAR.md) leave these
  // undefined.
  company?: string;
  epsEstimate?: string;
  // Post-print results — back-filled by the daily refresh-earnings-results
  // routine for past-dated rows. Both stay undefined for forward-dated
  // earnings; both are display-only (no schema impact on the bot's
  // earnings-gate which uses date+symbol only).
  actualEps?: string;
  postPrintMovePct?: string;
  // Computed at merge time: true if the same symbol+date also appears in
  // the bot's per-ticker cache (i.e. the user holds or is researching it).
  isHeld?: boolean;
};

// Calendar-day delta. Trading-day math is intentionally not done here —
// market-open enforces the 2-trading-day rule on the bot side; the dashboard
// just surfaces a heads-up.
export function daysUntilEarnings(
  date: string,
  today: Date = new Date()
): number | null {
  if (!date || /^none/i.test(date)) return null;
  const m = date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const target = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const t0 = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const ms = target.getTime() - t0.getTime();
  return Math.round(ms / 86_400_000);
}
