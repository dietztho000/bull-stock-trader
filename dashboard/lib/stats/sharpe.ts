import { mean, std, type DailyReturn } from "./returns";

const TRADING_DAYS = 252;

export function sharpe(rets: DailyReturn[], riskFreeAnnual = 0): number | null {
  const xs = rets.map((r) => r.ret);
  if (xs.length < 2) return null;
  const dailyRf = riskFreeAnnual / TRADING_DAYS;
  const excess = xs.map((x) => x - dailyRf);
  const s = std(excess);
  if (s === 0) return null;
  return (mean(excess) / s) * Math.sqrt(TRADING_DAYS);
}

export function sortino(rets: DailyReturn[], riskFreeAnnual = 0): number | null {
  const xs = rets.map((r) => r.ret);
  if (xs.length < 2) return null;
  const dailyRf = riskFreeAnnual / TRADING_DAYS;
  const downside = xs
    .map((x) => x - dailyRf)
    .filter((x) => x < 0);
  if (downside.length < 2) return null;
  // downside deviation (use 0 as target)
  const dd = Math.sqrt(
    downside.reduce((a, b) => a + b * b, 0) / downside.length
  );
  if (dd === 0) return null;
  return (mean(xs.map((x) => x - dailyRf)) / dd) * Math.sqrt(TRADING_DAYS);
}

export function calmar(
  annualReturn: number | null,
  maxDdPct: number
): number | null {
  if (annualReturn == null || maxDdPct === 0) return null;
  return annualReturn / Math.abs(maxDdPct);
}

export function annualizedReturn(rets: DailyReturn[]): number | null {
  if (rets.length < 1) return null;
  const cumulative = rets.reduce((acc, r) => acc * (1 + r.ret), 1);
  const years = rets.length / TRADING_DAYS;
  if (years <= 0) return null;
  return cumulative ** (1 / years) - 1;
}
