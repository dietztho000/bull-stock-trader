"use client";

import { Kpi } from "@/components/ui/Card";
import { useAccountSummary } from "@/components/live/useAccountSummary";
import { fmtMoney } from "@/lib/format";
import type { AlpacaMode } from "@/lib/alpacaMode";

export function CashKpiTile({
  mode,
  accountId,
}: { mode?: AlpacaMode; accountId?: string | null }) {
  const s = useAccountSummary({ mode, accountId });
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
}
