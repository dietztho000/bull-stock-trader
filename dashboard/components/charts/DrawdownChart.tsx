"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

export function DrawdownChart({
  data,
  height = 220,
}: {
  data: { date: string; ddPct: number }[];
  height?: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="ddGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ef4444" stopOpacity={0.2} />
            <stop offset="100%" stopColor="#ef4444" stopOpacity={0.6} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="#232a36" strokeDasharray="3 3" />
        <XAxis dataKey="date" stroke="#8b95a7" tick={{ fontSize: 11 }} />
        <YAxis
          stroke="#8b95a7"
          tick={{ fontSize: 11 }}
          tickFormatter={(v) => `${(v * 100).toFixed(1)}%`}
          domain={[(dataMin: number) => Math.min(0, dataMin), 0]}
        />
        <Tooltip
          contentStyle={{
            background: "#161b25",
            border: "1px solid #232a36",
            borderRadius: 6,
            fontSize: 12,
          }}
          formatter={(v: number) => `${(v * 100).toFixed(2)}%`}
        />
        <Area
          type="monotone"
          dataKey="ddPct"
          stroke="#ef4444"
          fill="url(#ddGrad)"
          strokeWidth={1.5}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
