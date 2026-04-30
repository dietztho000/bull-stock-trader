import type { BenchmarkRow } from "../parsers/benchmark";

export type DrawdownPoint = {
  date: string;
  equity: number;
  peak: number;
  ddPct: number; // 0..-1
  ddDollar: number;
};

export type MaxDrawdown = {
  pct: number;
  dollar: number;
  peakDate: string | null;
  troughDate: string | null;
  recoveryDate: string | null;
  durationDays: number | null;
};

export function drawdownSeries(rows: BenchmarkRow[]): DrawdownPoint[] {
  let peak = -Infinity;
  const out: DrawdownPoint[] = [];
  for (const r of rows) {
    if (r.portfolio == null) continue;
    if (r.portfolio > peak) peak = r.portfolio;
    const dd = peak > 0 ? (r.portfolio - peak) / peak : 0;
    out.push({
      date: r.date,
      equity: r.portfolio,
      peak,
      ddPct: dd,
      ddDollar: r.portfolio - peak,
    });
  }
  return out;
}

export function maxDrawdown(series: DrawdownPoint[]): MaxDrawdown {
  let worst: DrawdownPoint | null = null;
  for (const p of series) {
    if (!worst || p.ddPct < worst.ddPct) worst = p;
  }
  if (!worst) {
    return {
      pct: 0,
      dollar: 0,
      peakDate: null,
      troughDate: null,
      recoveryDate: null,
      durationDays: null,
    };
  }
  // peak = last point before trough where equity == peak
  let peakDate: string | null = null;
  for (const p of series) {
    if (p.date > worst.date) break;
    if (p.equity >= worst.peak) peakDate = p.date;
  }
  // recovery = first point after trough where equity >= peak
  let recoveryDate: string | null = null;
  for (const p of series) {
    if (p.date <= worst.date) continue;
    if (p.equity >= worst.peak) {
      recoveryDate = p.date;
      break;
    }
  }
  const days =
    peakDate && worst.date
      ? Math.round(
          (new Date(worst.date).getTime() - new Date(peakDate).getTime()) /
            86400000
        )
      : null;
  return {
    pct: worst.ddPct,
    dollar: worst.ddDollar,
    peakDate,
    troughDate: worst.date,
    recoveryDate,
    durationDays: days,
  };
}
