"use client";

import useSWR from "swr";
import clsx from "clsx";
import { fmtMoney, fmtPct, fmtSignedMoney } from "@/lib/format";
import { alpacaApiUrl, type AlpacaMode } from "@/lib/alpacaMode";
import { Badge } from "@/components/ui/Card";
import {
  daysUntilEarnings,
  type EarningsEntry,
} from "@/lib/parsers/earningsCalendar.shared";

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

// Earnings map is loaded server-side and passed in. Stays in sync because
// the chokidar SSE stream calls router.refresh() on every memory file change.
type EarningsMapJson = Record<string, EarningsEntry>;

function EarningsCell({
  symbol,
  earnings,
}: {
  symbol: string;
  earnings?: EarningsMapJson;
}) {
  if (!earnings) return <span className="text-[var(--color-muted)]">—</span>;
  const entry = earnings[symbol.toUpperCase()];
  if (!entry || !entry.date || /^none/i.test(entry.date)) {
    return <span className="text-[var(--color-muted)]">—</span>;
  }
  const days = daysUntilEarnings(entry.date);
  if (days === null) return <span className="text-[var(--color-muted)]">—</span>;
  const typeSuffix = entry.type ? ` (${entry.type})` : "";
  if (days < 0) return <span className="text-[var(--color-muted)]">—</span>;
  if (days === 0) {
    return <Badge tone="down">EPS today{typeSuffix}</Badge>;
  }
  if (days <= 2) {
    return <Badge tone="down">EPS in {days}d{typeSuffix}</Badge>;
  }
  if (days <= 5) {
    return <Badge tone="warn">EPS in {days}d{typeSuffix}</Badge>;
  }
  return (
    <span className="text-[11px] text-[var(--color-muted)]">
      EPS in {days}d
    </span>
  );
}

function GapCell({
  symbol,
  gaps,
}: {
  symbol: string;
  gaps?: Record<string, number | null>;
}) {
  if (!gaps) return null;
  const gap = gaps[symbol.toUpperCase()];
  if (gap == null) return null;
  const pct = gap * 100;
  if (pct <= -7) return <Badge tone="down">Gap {pct.toFixed(1)}%</Badge>;
  if (Math.abs(pct) >= 5) return <Badge tone="warn">Gap {pct.toFixed(1)}%</Badge>;
  return null;
}

type LadderJson = Record<
  string,
  { symbol: string; rungFiredAt: string; firedAtPct: number }
>;

function LadderCell({
  symbol,
  unrealizedPlpc,
  ladder,
}: {
  symbol: string;
  unrealizedPlpc: number;
  ladder?: LadderJson;
}) {
  const entry = ladder?.[symbol.toUpperCase()];
  if (entry) {
    return (
      <Badge tone="up">
        Rung 1 ↓50% @+{entry.firedAtPct.toFixed(1)}%
      </Badge>
    );
  }
  const pct = unrealizedPlpc * 100;
  if (pct >= 18 && pct < 20) {
    return <Badge tone="warn">Approaching +20%</Badge>;
  }
  return <span className="text-[var(--color-muted)]">—</span>;
}

export function LivePositions({
  mode,
  earnings,
  overnightGaps,
  ladder,
}: {
  mode?: AlpacaMode;
  earnings?: EarningsMapJson;
  overnightGaps?: Record<string, number | null>;
  ladder?: LadderJson;
} = {}) {
  const { data, error, isLoading } = useSWR<Position[] | { error: string }>(
    alpacaApiUrl("positions", mode),
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
            <th className="py-1.5 pr-3">Ladder</th>
            <th className="py-1.5 pr-3">Earnings</th>
          </tr>
        </thead>
        <tbody>
          {positions.map((p) => {
            const pct = Number(p.unrealized_plpc) * 100;
            const pl = Number(p.unrealized_pl);
            return (
              <tr key={p.symbol} className="border-t border-[var(--color-border)]">
                <td className="py-1.5 pr-3 font-semibold">
                  <div className="flex items-center gap-1.5">
                    <span>{p.symbol}</span>
                    <GapCell symbol={p.symbol} gaps={overnightGaps} />
                  </div>
                </td>
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
                <td className="py-1.5 pr-3">
                  <LadderCell
                    symbol={p.symbol}
                    unrealizedPlpc={Number(p.unrealized_plpc)}
                    ladder={ladder}
                  />
                </td>
                <td className="py-1.5 pr-3">
                  <EarningsCell symbol={p.symbol} earnings={earnings} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
