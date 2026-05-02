"use client";

import { Kpi } from "@/components/ui/Card";
import { useAccountSummary } from "@/components/live/useAccountSummary";
import { fmtMoney } from "@/lib/format";
import type { AlpacaMode } from "@/lib/alpacaMode";

export function BuyingPowerKpiTile({ mode }: { mode?: AlpacaMode }) {
  const s = useAccountSummary(mode);
  if (s.loading) return <Kpi label="Buying power" value="—" />;
  if ("error" in s)
    return (
      <div className="text-xs text-[var(--color-down)] frost rounded-xl p-3.5">
        Buying power: {s.error}
      </div>
    );
  return <Kpi label="Buying power" value={fmtMoney(s.buyingPower)} />;
}
