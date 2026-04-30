"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Cell,
} from "recharts";

type FormatKind = "money" | "pct" | "number";

function fmt(kind: FormatKind, v: number): string {
  switch (kind) {
    case "pct":
      return `${v.toFixed(1)}%`;
    case "money":
      return `$${v.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
    case "number":
    default:
      return v.toFixed(2);
  }
}

export function SectorBars({
  data,
  format = "money",
  height = 240,
}: {
  data: { sector: string; value: number }[];
  format?: FormatKind;
  height?: number;
}) {
  if (!data.length)
    return <div className="text-xs text-[var(--color-muted)]">No closed trades yet.</div>;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid stroke="#232a36" strokeDasharray="3 3" />
        <XAxis dataKey="sector" stroke="#8b95a7" tick={{ fontSize: 10 }} interval={0} angle={-20} textAnchor="end" height={60} />
        <YAxis stroke="#8b95a7" tick={{ fontSize: 11 }} tickFormatter={(v) => fmt(format, v)} />
        <Tooltip
          contentStyle={{
            background: "#161b25",
            border: "1px solid #232a36",
            borderRadius: 6,
            fontSize: 12,
          }}
          formatter={(v: number) => fmt(format, v)}
        />
        <Bar dataKey="value">
          {data.map((d, i) => (
            <Cell key={i} fill={d.value >= 0 ? "#22c55e" : "#ef4444"} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
