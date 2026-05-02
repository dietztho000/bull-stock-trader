// Conviction-weighted sizing helpers (rule #19).
// Score → target_pct of equity ladder. The bot enforces this in
// market-open and /trade BEFORE order submit; this module mirrors
// the math for dashboard display only.

export function targetPctForScore(score: number | null | undefined): number | null {
  if (score == null || !Number.isFinite(score)) return null;
  if (score >= 10) return 0.20;
  if (score >= 9) return 0.18;
  if (score >= 8) return 0.15;
  if (score >= 7) return 0.12;
  return null; // score < 7 trades shouldn't exist (rule #12 blocks them).
}

export function actualPctOfEquity(
  shares: number | null | undefined,
  entry: number | null | undefined,
  equityAtEntry: number | null | undefined
): number | null {
  if (
    shares == null ||
    entry == null ||
    equityAtEntry == null ||
    equityAtEntry <= 0
  )
    return null;
  return (shares * entry) / equityAtEntry;
}

// 1 pp tolerance — bot picks an integer share count so actual rarely
// matches target exactly. Anything more than 1pp ABOVE target is a
// rule violation worth flagging.
export const SIZING_TOLERANCE = 0.01;

export type SizingStatus = "match" | "under" | "over" | "unknown";

export function sizingStatus(
  actual: number | null,
  target: number | null
): SizingStatus {
  if (actual == null || target == null) return "unknown";
  const delta = actual - target;
  if (Math.abs(delta) <= SIZING_TOLERANCE) return "match";
  return delta > 0 ? "over" : "under";
}
