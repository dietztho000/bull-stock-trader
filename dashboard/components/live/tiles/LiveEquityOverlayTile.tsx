"use client";

import { Card, Kpi } from "@/components/ui/Card";
import { useAccountSummary } from "@/components/live/useAccountSummary";
import { useTradingAccount } from "@/lib/tradingAccountContext";
import {
  fmtMoney,
  fmtPct,
  fmtSignedMoney,
  colorOf,
} from "@/lib/format";

export function LiveEquityOverlayTile() {
  const { account } = useTradingAccount();
  const s = useAccountSummary();
  const accountLabel = account === "live" ? "Live" : "Paper";

  return (
    <Card
      title={`Live Alpaca snapshot — ${accountLabel}`}
      subtitle="History below reflects the active bot; this overlay is the currently selected account."
    >
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {s.loading ? (
          <Kpi label="Equity" value="—" />
        ) : "error" in s ? (
          <div className="col-span-full text-xs text-[var(--color-down)]">
            Live snapshot: {s.error}
          </div>
        ) : (
          <>
            <Kpi
              label="Equity"
              value={fmtMoney(s.equity)}
              delta={{
                value: fmtSignedMoney(s.dayPnl),
                positive: colorOf(s.dayPnl),
              }}
              hint={`day ${fmtPct(s.dayPct)}`}
            />
            <Kpi label="Cash" value={fmtMoney(s.cash)} hint={fmtPct(s.cashPct)} />
            <Kpi label="Deployed" value={fmtPct(s.deployed)} />
            <Kpi label="Buying power" value={fmtMoney(s.buyingPower)} />
          </>
        )}
      </div>
    </Card>
  );
}
