"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  ReferenceLine,
  Cell,
} from "recharts";

type FormatKind = "pct" | "money" | "number" | "score";

function fmt(kind: FormatKind, v: number): string {
  switch (kind) {
    case "pct":
      return `${v.toFixed(1)}%`;
    case "money":
      return `$${v.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
    case "score":
      return v.toFixed(0);
    case "number":
    default:
      return v.toFixed(2);
  }
}

export function Histogram({
  values,
  bins = 20,
  height = 220,
  format = "number",
  zeroLine = true,
}: {
  values: number[];
  bins?: number;
  height?: number;
  format?: FormatKind;
  zeroLine?: boolean;
}) {
  if (!values.length) {
    return (
      <div className="text-xs text-[var(--color-muted)]">No data yet.</div>
    );
  }
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const w = range / bins;
  const buckets = Array.from({ length: bins }, (_, i) => ({
    x: min + i * w + w / 2,
    count: 0,
  }));
  for (const v of values) {
    const idx = Math.min(bins - 1, Math.max(0, Math.floor((v - min) / w)));
    buckets[idx].count += 1;
  }
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={buckets} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid stroke="#232a36" strokeDasharray="3 3" />
        <XAxis
          dataKey="x"
          stroke="#8b95a7"
          tick={{ fontSize: 10 }}
          tickFormatter={(v) => fmt(format, v)}
        />
        <YAxis stroke="#8b95a7" tick={{ fontSize: 11 }} allowDecimals={false} />
        <Tooltip
          contentStyle={{
            background: "#161b25",
            border: "1px solid #232a36",
            borderRadius: 6,
            fontSize: 12,
          }}
          labelFormatter={(v) => fmt(format, Number(v))}
        />
        {zeroLine && <ReferenceLine x={0} stroke="#8b95a7" strokeDasharray="2 2" />}
        <Bar dataKey="count">
          {buckets.map((b, i) => (
            <Cell key={i} fill={b.x < 0 ? "#ef4444" : "#22c55e"} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
