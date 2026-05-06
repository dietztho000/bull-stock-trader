"use client";

import { memo } from "react";
import { Kpi } from "@/components/ui/Card";
import { useAccountSummary } from "@/components/live/useAccountSummary";
import type { AlpacaScope } from "@/lib/alpacaMode";

export const DeployedKpiTile = memo(function DeployedKpiTile({
  scope,
}: { scope?: AlpacaScope }) {
  const s = useAccountSummary(scope);
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
});
