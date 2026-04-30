import type { DailyReturn } from "./returns";

export function bestWorst(rets: DailyReturn[]) {
  let best: DailyReturn | null = null;
  let worst: DailyReturn | null = null;
  for (const r of rets) {
    if (!best || r.ret > best.ret) best = r;
    if (!worst || r.ret < worst.ret) worst = r;
  }
  return { best, worst };
}

export function monthlyAggregates(rets: DailyReturn[]) {
  // Aggregate daily returns into compounded monthly returns.
  const map = new Map<string, number[]>();
  for (const r of rets) {
    const ym = r.date.slice(0, 7);
    const list = map.get(ym) ?? [];
    list.push(r.ret);
    map.set(ym, list);
  }
  return Array.from(map.entries())
    .map(([ym, xs]) => ({
      ym,
      ret: xs.reduce((acc, x) => acc * (1 + x), 1) - 1,
      days: xs.length,
    }))
    .sort((a, b) => a.ym.localeCompare(b.ym));
}
