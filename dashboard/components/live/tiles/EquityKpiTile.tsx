"use client";

import { Kpi } from "@/components/ui/Card";
import { useAccountSummary } from "@/components/live/useAccountSummary";
import { fmtMoney, fmtPct, fmtSignedMoney, colorOf } from "@/lib/format";
import type { AlpacaMode } from "@/lib/alpacaMode";

export function EquityKpiTile({
  mode,
  accountId,
}: { mode?: AlpacaMode; accountId?: string | null }) {
  const s = useAccountSummary({ mode, accountId });
  const label = mode === "paper" ? "Equity (paper)" : "Equity (live)";

  if (s.loading) return <Kpi label={label} value="—" />;
  if ("error" in s)
    return (
      <div className="text-xs text-[var(--color-down)] frost rounded-xl p-3.5">
        Equity: {s.error}
      </div>
    );

  return (
    <Kpi
      label={label}
      value={fmtMoney(s.equity)}
      delta={{ value: fmtSignedMoney(s.dayPnl), positive: colorOf(s.dayPnl) }}
      hint={`day ${fmtPct(s.dayPct)}`}
    />
  );
}
