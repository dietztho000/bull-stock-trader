import type { BenchmarkRow } from "@/lib/parsers/benchmark";

/**
 * Count of consecutive winning days at the tail of the benchmark series.
 * A "winning day" is one where the day-over-day portfolio change is > 0.
 * Falls back to the row's `dayPct` when adjacent portfolio values aren't comparable.
 *
 * Returns null when fewer than 2 rows are usable.
 */
export function consecutiveWinningDays(rows: BenchmarkRow[]): number | null {
  if (rows.length < 2) return null;
  let streak = 0;
  for (let i = rows.length - 1; i >= 0; i--) {
    const cur = rows[i];
    const prev = i > 0 ? rows[i - 1] : null;
    let dayPct: number | null = null;
    if (cur.dayPct != null) {
      dayPct = cur.dayPct;
    } else if (cur.portfolio != null && prev?.portfolio != null) {
      dayPct = cur.portfolio - prev.portfolio;
    }
    if (dayPct == null) break;
    if (dayPct > 0) streak += 1;
    else break;
  }
  return streak;
}
