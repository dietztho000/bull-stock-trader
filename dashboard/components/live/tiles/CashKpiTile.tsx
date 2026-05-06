"use client";

import { memo } from "react";
import { Kpi } from "@/components/ui/Card";
import { useAccountSummary } from "@/components/live/useAccountSummary";
import { fmtMoney } from "@/lib/format";
import type { AlpacaScope } from "@/lib/alpacaMode";

export const CashKpiTile = memo(function CashKpiTile({
  scope,
}: { scope?: AlpacaScope }) {
  const s = useAccountSummary(scope);
  if (s.loading) return <Kpi label="Cash" value="—" />;
  if ("error" in s)
    return (
      <div className="text-xs text-[var(--color-down)] frost rounded-xl p-3.5">
        Cash: {s.error}
      </div>
    );
  return (
    <Kpi
      label="Cash"
      value={fmtMoney(s.cash)}
      hint={`${s.cashPct.toFixed(1)}%`}
    />
  );
});
