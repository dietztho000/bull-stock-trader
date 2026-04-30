"use client";

import clsx from "clsx";

// Simple GitHub-style calendar heatmap of daily returns.
export function CalendarHeatmap({
  data,
}: {
  data: { date: string; ret: number }[];
}) {
  if (!data.length)
    return <div className="text-xs text-[var(--color-muted)]">No daily data yet.</div>;

  // Group by ISO week.
  const map = new Map<string, { date: string; ret: number }>();
  for (const d of data) map.set(d.date, d);

  const start = new Date(data[0].date);
  const end = new Date(data[data.length - 1].date);
  const days: { date: string; ret: number | null; weekday: number }[] = [];
  for (let t = start.getTime(); t <= end.getTime(); t += 86400000) {
    const d = new Date(t);
    const iso = d.toISOString().slice(0, 10);
    const v = map.get(iso);
    days.push({ date: iso, ret: v?.ret ?? null, weekday: d.getUTCDay() });
  }

  const weeks: typeof days[] = [];
  let cur: typeof days = [];
  for (const d of days) {
    if (d.weekday === 0 && cur.length) {
      weeks.push(cur);
      cur = [];
    }
    cur.push(d);
  }
  if (cur.length) weeks.push(cur);

  const maxAbs = Math.max(0.005, ...data.map((d) => Math.abs(d.ret)));

  return (
    <div className="overflow-x-auto">
      <div className="flex gap-[2px]">
        {weeks.map((w, wi) => (
          <div key={wi} className="flex flex-col gap-[2px]">
            {Array.from({ length: 7 }).map((_, di) => {
              const cell = w.find((d) => d.weekday === di);
              const r = cell?.ret;
              const intensity = r != null ? Math.min(1, Math.abs(r) / maxAbs) : 0;
              const bg = r == null
                ? "#161b25"
                : r >= 0
                  ? `rgba(34,197,94,${0.15 + intensity * 0.85})`
                  : `rgba(239,68,68,${0.15 + intensity * 0.85})`;
              return (
                <div
                  key={di}
                  className={clsx("h-3 w-3 rounded-[2px] border border-[var(--color-border)]")}
                  style={{ background: bg }}
                  title={cell ? `${cell.date}: ${(r! * 100).toFixed(2)}%` : ""}
                />
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
