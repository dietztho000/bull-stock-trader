"use client";

import useSWR from "swr";
import { Kpi } from "@/components/ui/Card";
import { fmtMoney, fmtPct, fmtSignedMoney, colorOf } from "@/lib/format";

const fetcher = (u: string) => fetch(u).then((r) => r.json());

type Account = {
  equity: string;
  last_equity: string;
  cash: string;
  buying_power: string;
  daytrade_count: number;
  portfolio_value: string;
};

export function LiveAccountKpis() {
  const { data, error } = useSWR<Account | { error: string }>(
    "/api/alpaca/account",
    fetcher,
    { refreshInterval: 5000 }
  );

  if (error || (data && "error" in data)) {
    const msg = error?.message ?? (data as { error: string })?.error;
    return (
      <div className="text-xs text-[var(--color-down)] col-span-full">
        Alpaca account: {msg ?? "failed to load"}
      </div>
    );
  }
  if (!data) {
    return (
      <>
        {Array.from({ length: 5 }).map((_, i) => (
          <Kpi key={i} label="Loading" value="—" />
        ))}
      </>
    );
  }
  const a = data as Account;
  const equity = Number(a.equity);
  const lastEquity = Number(a.last_equity);
  const dayPnl = equity - lastEquity;
  const dayPct = lastEquity > 0 ? (dayPnl / lastEquity) * 100 : 0;
  const cash = Number(a.cash);
  const cashPct = equity > 0 ? (cash / equity) * 100 : 0;
  const deployed = 100 - cashPct;

  return (
    <>
      <Kpi
        label="Equity (live)"
        value={fmtMoney(equity)}
        delta={{ value: fmtSignedMoney(dayPnl), positive: colorOf(dayPnl) }}
        hint={`day ${fmtPct(dayPct)}`}
      />
      <Kpi label="Cash" value={fmtMoney(cash)} hint={`${cashPct.toFixed(1)}%`} />
      <Kpi
        label="Deployed"
        value={`${deployed.toFixed(1)}%`}
        hint="target 75–85%"
      />
      <Kpi
        label="Buying power"
        value={fmtMoney(Number(a.buying_power))}
      />
      <Kpi
        label="Day trades"
        value={`${a.daytrade_count}/3`}
        hint="rolling 5d"
      />
    </>
  );
}
