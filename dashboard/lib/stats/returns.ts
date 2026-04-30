import type { BenchmarkRow } from "../parsers/benchmark";

export type DailyReturn = {
  date: string;
  portfolio: number;
  ret: number; // fraction (0.005 = 0.5%)
  spyClose: number | null;
  spyRet: number | null;
  alpha: number | null;
};

export function dailyReturns(
  rows: BenchmarkRow[],
  startingEquity: number | null
): DailyReturn[] {
  const out: DailyReturn[] = [];
  let prev = startingEquity ?? null;
  let prevSpy: number | null = null;
  for (const r of rows) {
    if (r.portfolio == null) continue;
    const ret = prev != null && prev > 0 ? (r.portfolio - prev) / prev : 0;
    const spyRet =
      prevSpy != null && prevSpy > 0 && r.spyClose != null
        ? (r.spyClose - prevSpy) / prevSpy
        : null;
    out.push({
      date: r.date,
      portfolio: r.portfolio,
      ret,
      spyClose: r.spyClose,
      spyRet,
      alpha: spyRet != null ? ret - spyRet : null,
    });
    prev = r.portfolio;
    if (r.spyClose != null) prevSpy = r.spyClose;
  }
  return out;
}

export function mean(xs: number[]): number {
  if (!xs.length) return 0;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

export function std(xs: number[], sample = true): number {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  const v = xs.reduce((a, b) => a + (b - m) ** 2, 0) / (xs.length - (sample ? 1 : 0));
  return Math.sqrt(v);
}
