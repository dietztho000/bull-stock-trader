"use client";

import { memo } from "react";
import { Kpi } from "@/components/ui/Card";
import { useAccountSummary } from "@/components/live/useAccountSummary";
import type { AlpacaScope } from "@/lib/alpacaMode";

export const DayTradesKpiTile = memo(function DayTradesKpiTile({
  scope,
}: { scope?: AlpacaScope }) {
  const s = useAccountSummary(scope);
  if (s.loading) return <Kpi label="Day trades" value="—" />;
  if ("error" in s)
    return (
      <div className="text-xs text-[var(--color-down)] frost rounded-xl p-3.5">
        Day trades: {s.error}
      </div>
    );
  return (
    <Kpi
      label="Day trades"
      value={`${s.dayTradeCount}/3`}
      delta={
        s.dayTradeCount >= 3
          ? { value: "PDT lock risk", positive: false }
          : s.dayTradeCount >= 2
          ? { value: "approaching limit", positive: null }
          : undefined
      }
      hint="rolling 5d"
    />
  );
});
