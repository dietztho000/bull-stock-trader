"use client";

import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  ReferenceLine,
} from "recharts";

export function RScatter({
  data,
  height = 260,
}: {
  data: { x: number; y: number; symbol?: string; date?: string }[];
  height?: number;
}) {
  if (!data.length)
    return <div className="text-xs text-[var(--color-muted)]">Need closed trades with stops to compute R-multiples.</div>;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ScatterChart margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid stroke="#232a36" strokeDasharray="3 3" />
        <XAxis dataKey="x" type="number" stroke="#8b95a7" tick={{ fontSize: 11 }} name="Entry score" />
        <YAxis dataKey="y" type="number" stroke="#8b95a7" tick={{ fontSize: 11 }} name="Realized P&L %" tickFormatter={(v) => `${v.toFixed(0)}%`} />
        <Tooltip
          contentStyle={{
            background: "#161b25",
            border: "1px solid #232a36",
            borderRadius: 6,
            fontSize: 12,
          }}
          formatter={(v: number, n: string) => (n === "y" ? `${v.toFixed(2)}%` : v.toString())}
        />
        <ReferenceLine y={0} stroke="#8b95a7" strokeDasharray="2 2" />
        <Scatter data={data} fill="#3ea6ff" />
      </ScatterChart>
    </ResponsiveContainer>
  );
}
