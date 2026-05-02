"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
  ReferenceLine,
} from "recharts";

type Point = { date: string; actual: number | null; sim: number | null };

export function BacktestCurve({
  actual,
  sim,
  height = 280,
}: {
  actual: { date: string; pnl: number }[];
  sim: { date: string; pnl: number }[];
  height?: number;
}) {
  // Merge both series on date so Recharts can render two lines.
  const dates = Array.from(
    new Set([...actual.map((r) => r.date), ...sim.map((r) => r.date)])
  ).sort();
  const actualMap = new Map(actual.map((r) => [r.date, r.pnl]));
  const simMap = new Map(sim.map((r) => [r.date, r.pnl]));
  // Forward-fill so the line stays at the last known cumulative value
  // when a series doesn't have a point on a given date.
  let lastA = 0;
  let lastS = 0;
  const data: Point[] = dates.map((d) => {
    if (actualMap.has(d)) lastA = actualMap.get(d) as number;
    if (simMap.has(d)) lastS = simMap.get(d) as number;
    return { date: d, actual: lastA, sim: lastS };
  });

  if (data.length === 0) {
    return (
      <div className="text-xs text-[var(--color-muted)] py-3">
        Cumulative P&L curves will populate once trades close.
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid stroke="#232a36" strokeDasharray="3 3" />
        <XAxis dataKey="date" stroke="#8b95a7" tick={{ fontSize: 11 }} />
        <YAxis
          stroke="#8b95a7"
          tick={{ fontSize: 11 }}
          tickFormatter={(v) => `$${v >= 0 ? "" : "-"}${Math.abs(v).toFixed(0)}`}
          domain={["auto", "auto"]}
        />
        <Tooltip
          contentStyle={{
            background: "#161b25",
            border: "1px solid #232a36",
            borderRadius: 6,
            fontSize: 12,
          }}
          formatter={(v: number) =>
            `${v >= 0 ? "+" : ""}$${Math.abs(v).toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}`
          }
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <ReferenceLine y={0} stroke="#8b95a7" strokeDasharray="4 4" />
        <Line
          type="monotone"
          dataKey="actual"
          name="Actual cumulative P&L"
          stroke="#3ea6ff"
          strokeWidth={2}
          dot={false}
        />
        <Line
          type="monotone"
          dataKey="sim"
          name="Sim cumulative P&L"
          stroke="#a78bfa"
          strokeWidth={2}
          dot={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
