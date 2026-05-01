"use client";

import useSWR from "swr";
import { fmtMoney } from "@/lib/format";
import { alpacaApiUrl, type AlpacaMode } from "@/lib/alpacaMode";

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

export function LiveOrders({ mode }: { mode?: AlpacaMode } = {}) {
  const { data, error } = useSWR<Order[] | { error: string }>(
    alpacaApiUrl("orders", mode),
    fetcher,
    { refreshInterval: 8000 }
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
          <th className="py-1.5 pr-3">Trail / Limit / Stop</th>
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
            <td className="py-1.5 pr-3">
              {o.trail_percent && `${o.trail_percent}%`}
              {o.limit_price && fmtMoney(Number(o.limit_price))}
              {o.stop_price && ` stop ${fmtMoney(Number(o.stop_price))}`}
            </td>
            <td className="py-1.5 pr-3 text-[var(--color-muted)]">{o.status}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
