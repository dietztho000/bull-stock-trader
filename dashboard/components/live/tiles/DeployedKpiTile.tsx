"use client";

import { Kpi } from "@/components/ui/Card";
import { useAccountSummary } from "@/components/live/useAccountSummary";
import type { AlpacaMode } from "@/lib/alpacaMode";

export function DeployedKpiTile({
  mode,
  accountId,
}: { mode?: AlpacaMode; accountId?: string | null }) {
  const s = useAccountSummary({ mode, accountId });
  if (s.loading) return <Kpi label="Deployed" value="—" />;
  if ("error" in s)
    return (
      <div className="text-xs text-[var(--color-down)] frost rounded-xl p-3.5">
        Deployed: {s.error}
      </div>
    );
  return (
    <Kpi
      label="Deployed"
      value={`${s.deployed.toFixed(1)}%`}
      hint="target 75–85%"
    />
  );
}
