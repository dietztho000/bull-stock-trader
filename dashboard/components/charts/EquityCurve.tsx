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

export type EquityPoint = {
  date: string;
  portfolio: number | null;
  spy?: number | null;
};

export function EquityCurve({
  data,
  startingEquity,
  showSpy = true,
  height = 300,
}: {
  data: EquityPoint[];
  startingEquity?: number | null;
  showSpy?: boolean;
  height?: number;
}) {
  // Normalize SPY to portfolio starting point so they share an axis
  const start = startingEquity ?? data[0]?.portfolio ?? 1;
  const spyStart = data.find((d) => d.spy != null)?.spy ?? null;
  const norm = data.map((d) => ({
    date: d.date,
    portfolio: d.portfolio,
    spyNormalized:
      d.spy != null && spyStart ? (d.spy / spyStart) * start : null,
  }));

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={norm} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid stroke="#232a36" strokeDasharray="3 3" />
        <XAxis dataKey="date" stroke="#8b95a7" tick={{ fontSize: 11 }} />
        <YAxis
          stroke="#8b95a7"
          tick={{ fontSize: 11 }}
          tickFormatter={(v) => `$${(v / 1000).toFixed(1)}k`}
          domain={["auto", "auto"]}
        />
        <Tooltip
          contentStyle={{
            background: "#161b25",
            border: "1px solid #232a36",
            borderRadius: 6,
            fontSize: 12,
          }}
          formatter={(v: number) => `$${v?.toLocaleString?.() ?? v}`}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        {startingEquity != null && (
          <ReferenceLine y={startingEquity} stroke="#8b95a7" strokeDasharray="4 4" />
        )}
        <Line
          type="monotone"
          dataKey="portfolio"
          name="Portfolio"
          stroke="#3ea6ff"
          strokeWidth={2}
          dot={false}
        />
        {showSpy && (
          <Line
            type="monotone"
            dataKey="spyNormalized"
            name="SPY (norm.)"
            stroke="#a78bfa"
            strokeWidth={1.5}
            dot={false}
          />
        )}
      </LineChart>
    </ResponsiveContainer>
  );
}
