"use client";

import useSWR from "swr";
import clsx from "clsx";
import { fmtMoney, fmtPct, fmtSignedMoney } from "@/lib/format";

const fetcher = (u: string) => fetch(u).then((r) => r.json());

type Position = {
  symbol: string;
  qty: string;
  avg_entry_price: string;
  current_price: string;
  market_value: string;
  unrealized_pl: string;
  unrealized_plpc: string;
};

export function LivePositions() {
  const { data, error, isLoading } = useSWR<Position[] | { error: string }>(
    "/api/alpaca/positions",
    fetcher,
    { refreshInterval: 5000 }
  );

  if (error || (data && "error" in data)) {
    const msg = error?.message ?? (data as { error: string })?.error;
    return (
      <div className="text-xs text-[var(--color-down)]">
        Alpaca: {msg ?? "failed to load"}
      </div>
    );
  }
  if (isLoading || !data) {
    return <div className="text-xs text-[var(--color-muted)]">Loading positions…</div>;
  }
  const positions = data as Position[];
  if (!positions.length) {
    return <div className="text-xs text-[var(--color-muted)]">No open positions.</div>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm tabular">
        <thead>
          <tr className="text-left text-[11px] uppercase tracking-wider text-[var(--color-muted)]">
            <th className="py-1.5 pr-3">Ticker</th>
            <th className="py-1.5 pr-3">Qty</th>
            <th className="py-1.5 pr-3">Entry</th>
            <th className="py-1.5 pr-3">Last</th>
            <th className="py-1.5 pr-3">Mkt value</th>
            <th className="py-1.5 pr-3">Unrealized</th>
            <th className="py-1.5 pr-3">%</th>
          </tr>
        </thead>
        <tbody>
          {positions.map((p) => {
            const pct = Number(p.unrealized_plpc) * 100;
            const pl = Number(p.unrealized_pl);
            return (
              <tr key={p.symbol} className="border-t border-[var(--color-border)]">
                <td className="py-1.5 pr-3 font-semibold">{p.symbol}</td>
                <td className="py-1.5 pr-3">{Number(p.qty).toLocaleString()}</td>
                <td className="py-1.5 pr-3">{fmtMoney(Number(p.avg_entry_price))}</td>
                <td className="py-1.5 pr-3">{fmtMoney(Number(p.current_price))}</td>
                <td className="py-1.5 pr-3">{fmtMoney(Number(p.market_value))}</td>
                <td
                  className={clsx(
                    "py-1.5 pr-3",
                    pl > 0 && "text-[var(--color-up)]",
                    pl < 0 && "text-[var(--color-down)]"
                  )}
                >
                  {fmtSignedMoney(pl)}
                </td>
                <td
                  className={clsx(
                    "py-1.5 pr-3",
                    pct > 0 && "text-[var(--color-up)]",
                    pct < 0 && "text-[var(--color-down)]"
                  )}
                >
                  {fmtPct(pct)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
