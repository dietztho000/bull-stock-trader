"use client";

import useSWR from "swr";
import { fmtMoney } from "@/lib/format";
import { alpacaApiUrl, type AlpacaMode } from "@/lib/alpacaMode";
import { useTradingAccountOptional } from "@/lib/tradingAccountContext";
import { useLiveSwr } from "@/lib/useLiveSwr";
import { Badge } from "@/components/ui/Card";

const fetcher = (u: string) => fetch(u).then((r) => r.json());

type Order = {
  symbol: string;
  side: string;
  qty: string;
  type: string;
  trail_percent?: string;
  limit_price?: string;
  stop_price?: string;
  status: string;
};

function StopCell({ o }: { o: Order }) {
  if (o.type === "trailing_stop" && o.trail_percent) {
    return <span>trail {Number(o.trail_percent).toFixed(1)}%</span>;
  }
  if (o.stop_price) {
    return <span>{fmtMoney(Number(o.stop_price))}</span>;
  }
  if (o.limit_price && (o.type === "limit" || o.type === "buy" || o.side === "buy")) {
    return <span>limit {fmtMoney(Number(o.limit_price))}</span>;
  }
  return <span className="text-[var(--color-muted)]">—</span>;
}

function LimitFloorCell({ o }: { o: Order }) {
  if (o.type === "stop_limit" && o.limit_price) {
    return <Badge tone="warn">{fmtMoney(Number(o.limit_price))}</Badge>;
  }
  return <span className="text-[var(--color-muted)]">—</span>;
}

export function LiveOrders({ mode }: { mode?: AlpacaMode } = {}) {
  const ctx = useTradingAccountOptional();
  const effectiveMode = mode ?? ctx?.account;
  const liveOpts = useLiveSwr(8000);
  const { data, error } = useSWR<Order[] | { error: string }>(
    alpacaApiUrl("orders", effectiveMode),
    fetcher,
    { ...liveOpts, keepPreviousData: true }
  );
  if (error || (data && "error" in data)) {
    const msg = error?.message ?? (data as { error: string })?.error;
    return <div className="text-xs text-[var(--color-down)]">Orders: {msg}</div>;
  }
  if (!data) return <div className="text-xs text-[var(--color-muted)]">Loading orders…</div>;
  const orders = data as Order[];
  if (!orders.length)
    return <div className="text-xs text-[var(--color-muted)]">No open orders.</div>;
  return (
    <table className="w-full text-sm tabular">
      <thead>
        <tr className="text-left text-[11px] uppercase tracking-wider text-[var(--color-muted)]">
          <th className="py-1.5 pr-3">Ticker</th>
          <th className="py-1.5 pr-3">Side</th>
          <th className="py-1.5 pr-3">Qty</th>
          <th className="py-1.5 pr-3">Type</th>
          <th className="py-1.5 pr-3">Stop</th>
          <th className="py-1.5 pr-3">Limit floor</th>
          <th className="py-1.5 pr-3">Status</th>
        </tr>
      </thead>
      <tbody>
        {orders.map((o, i) => (
          <tr key={i} className="border-t border-[var(--color-border)]">
            <td className="py-1.5 pr-3 font-semibold">{o.symbol}</td>
            <td className="py-1.5 pr-3 capitalize">{o.side}</td>
            <td className="py-1.5 pr-3">{o.qty}</td>
            <td className="py-1.5 pr-3">{o.type}</td>
            <td className="py-1.5 pr-3"><StopCell o={o} /></td>
            <td className="py-1.5 pr-3"><LimitFloorCell o={o} /></td>
            <td className="py-1.5 pr-3 text-[var(--color-muted)]">{o.status}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
