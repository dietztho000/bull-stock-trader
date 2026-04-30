"use client";

import {
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
  ReferenceLine,
  Cell,
} from "recharts";

export function AlphaChart({
  data,
  height = 260,
}: {
  data: { date: string; alpha: number; cumAlpha: number }[];
  height?: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid stroke="#232a36" strokeDasharray="3 3" />
        <XAxis dataKey="date" stroke="#8b95a7" tick={{ fontSize: 11 }} />
        <YAxis
          yAxisId="left"
          stroke="#8b95a7"
          tick={{ fontSize: 11 }}
          tickFormatter={(v) => `${(v * 100).toFixed(2)}%`}
        />
        <YAxis
          yAxisId="right"
          orientation="right"
          stroke="#8b95a7"
          tick={{ fontSize: 11 }}
          tickFormatter={(v) => `${(v * 100).toFixed(1)}%`}
        />
        <Tooltip
          contentStyle={{
            background: "#161b25",
            border: "1px solid #232a36",
            borderRadius: 6,
            fontSize: 12,
          }}
          formatter={(v: number) => `${(v * 100).toFixed(3)}%`}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <ReferenceLine yAxisId="left" y={0} stroke="#8b95a7" strokeDasharray="2 2" />
        <Bar yAxisId="left" dataKey="alpha" name="Daily alpha">
          {data.map((d, i) => (
            <Cell key={i} fill={d.alpha >= 0 ? "#22c55e" : "#ef4444"} />
          ))}
        </Bar>
        <Line
          yAxisId="right"
          type="monotone"
          dataKey="cumAlpha"
          name="Cumulative alpha"
          stroke="#3ea6ff"
          strokeWidth={2}
          dot={false}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
