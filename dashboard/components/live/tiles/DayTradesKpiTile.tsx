"use client";

import { Kpi } from "@/components/ui/Card";
import { useAccountSummary } from "@/components/live/useAccountSummary";
import type { AlpacaMode } from "@/lib/alpacaMode";

export function DayTradesKpiTile({
  mode,
  accountId,
}: { mode?: AlpacaMode; accountId?: string | null }) {
  const s = useAccountSummary({ mode, accountId });
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
}
