"use client";

import useSWR from "swr";
import clsx from "clsx";
import Link from "next/link";
import { Card, Badge } from "@/components/ui/Card";
import { fmtMoney, fmtPct, fmtSignedMoney, colorOf } from "@/lib/format";
import type { LeaderboardRow } from "@/app/api/bots/leaderboard/route";
import type { BotEquity } from "@/lib/bots/virtualEquity";

const fetcher = (u: string) => fetch(u).then((r) => r.json());

type EquityResp = { equity: BotEquity } | { error: string };

export function BotsCompare() {
  const { data, error, isLoading } = useSWR<{ rows: LeaderboardRow[] }>(
    "/api/bots/leaderboard",
    fetcher,
    { refreshInterval: 60_000, revalidateOnFocus: false, keepPreviousData: true }
  );

  if (isLoading && !data) {
    return (
      <div className="space-y-5">
        <Header />
        <div className="text-xs text-[var(--color-muted)]">Loading bots…</div>
      </div>
    );
  }
  if (error) {
    return (
      <div className="space-y-5">
        <Header />
        <Card title="Failed to load">
          <div className="text-xs text-[var(--color-down)]">
            {error instanceof Error ? error.message : String(error)}
          </div>
        </Card>
      </div>
    );
  }
  const rows = data?.rows ?? [];
  if (rows.length === 0) {
    return (
      <div className="space-y-5">
        <Header />
        <Card title="No bots configured">
          <div className="text-xs text-[var(--color-muted)]">
            Add bots at <Link href="/bots" className="text-[var(--color-accent)] hover:underline">/bots</Link> to compare them here.
          </div>
        </Card>
      </div>
    );
  }

  // Layout: each bot gets a column. On narrow screens wraps to 1-col, then 2,
  // then 3+. Capped width per column so the comparison stays scannable.
  return (
    <div className="space-y-5">
      <Header />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
        {rows.map((r) => (
          <BotComparePanel key={r.botId} row={r} />
        ))}
      </div>
    </div>
  );
}

function Header() {
  return (
    <header className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Compare bots</h1>
        <p className="text-xs text-[var(--color-muted)] mt-0.5">
          Side-by-side equity, day P&amp;L, alpha, and live positions for every
          registered bot. Refreshes every 60s.
        </p>
      </div>
      <Link
        href="/bots"
        className="text-[11px] text-[var(--color-accent)] hover:underline"
      >
        ← Back to /bots
      </Link>
    </header>
  );
}

function BotComparePanel({ row }: { row: LeaderboardRow }) {
  const equityResp = useSWR<EquityResp>(
    `/api/bots/${encodeURIComponent(row.botId)}/equity`,
    fetcher,
    { refreshInterval: 30_000, keepPreviousData: true }
  );
  const equity = equityResp.data && "equity" in equityResp.data ? equityResp.data.equity : null;
  const equityErr =
    equityResp.data && "error" in equityResp.data
      ? equityResp.data.error
      : equityResp.error
      ? String(equityResp.error)
      : null;

  return (
    <Card
      title={
        <Link
          href={`/?bot=${encodeURIComponent(row.botId)}`}
          className="hover:text-[var(--color-accent)]"
        >
          {row.name}
        </Link>
      }
      subtitle={
        <span className="flex items-center gap-2">
          <Badge tone={row.mode === "live" ? "down" : "warn"}>{row.mode}</Badge>
          <span className="text-[10px] text-[var(--color-muted)] truncate">
            {row.accountLabel ?? row.accountId}
          </span>
        </span>
      }
    >
      <div className="space-y-3 text-sm">
        <div className="grid grid-cols-2 gap-2">
          <Stat label={equity?.isVirtual ? "Virtual eq" : "Equity"}>
            {equity ? fmtMoney(equity.equity) : "—"}
          </Stat>
          <Stat label="Cash">{equity ? fmtMoney(equity.cash) : "—"}</Stat>
          <Stat label="Day" tone={row.dayPct}>
            {row.dayPct != null ? fmtPct(row.dayPct) : "—"}
          </Stat>
          <Stat label="Alpha vs SPY" tone={row.phaseAlphaPct}>
            {row.phaseAlphaPct != null ? fmtPct(row.phaseAlphaPct) : "—"}
          </Stat>
          <Stat label="Trades / wk">{row.tradesThisWeek}</Stat>
          <Stat
            label="Max DD"
            tone={
              row.maxDrawdownPct != null
                ? row.maxDrawdownPct < 0
                  ? row.maxDrawdownPct
                  : null
                : null
            }
          >
            {row.maxDrawdownPct != null ? fmtPct(row.maxDrawdownPct * 100) : "—"}
          </Stat>
        </div>

        <div>
          <div className="text-[10px] uppercase tracking-[0.14em] text-[var(--color-muted)] font-semibold mb-1.5">
            Positions ({equity?.positions.length ?? 0})
          </div>
          {!equity ? (
            <div className="text-[11px] text-[var(--color-muted)]">
              {equityErr ?? "Loading…"}
            </div>
          ) : equity.positions.length === 0 ? (
            <div className="text-[11px] text-[var(--color-muted)]">No open positions.</div>
          ) : (
            <table className="w-full text-[11px] tabular">
              <thead>
                <tr className="text-[10px] uppercase tracking-[0.14em] text-[var(--color-muted)]">
                  <th className="text-left py-1 pr-2">Sym</th>
                  <th className="text-right py-1 pr-2">Mkt val</th>
                  <th className="text-right py-1 pr-2">Unreal</th>
                  <th className="text-right py-1">%</th>
                </tr>
              </thead>
              <tbody>
                {equity.positions.slice(0, 8).map((p) => (
                  <tr key={p.symbol} className="border-t border-[rgba(255,255,255,0.04)]">
                    <td className="py-1 pr-2 font-semibold">{p.symbol}</td>
                    <td className="py-1 pr-2 text-right">{fmtMoney(p.marketValue)}</td>
                    <td
                      className={clsx(
                        "py-1 pr-2 text-right",
                        colorOf(p.unrealizedPl) === true && "text-[var(--color-up)]",
                        colorOf(p.unrealizedPl) === false && "text-[var(--color-down)]"
                      )}
                    >
                      {fmtSignedMoney(p.unrealizedPl)}
                    </td>
                    <td
                      className={clsx(
                        "py-1 text-right",
                        p.unrealizedPlpc > 0 && "text-[var(--color-up)]",
                        p.unrealizedPlpc < 0 && "text-[var(--color-down)]"
                      )}
                    >
                      {fmtPct(p.unrealizedPlpc * 100)}
                    </td>
                  </tr>
                ))}
                {equity.positions.length > 8 && (
                  <tr>
                    <td colSpan={4} className="py-1 text-[10px] text-[var(--color-muted)]">
                      + {equity.positions.length - 8} more
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>

        {row.error && (
          <div className="text-[10px] text-[var(--color-down)] break-all">
            ⚠ {row.error}
          </div>
        )}
      </div>
    </Card>
  );
}

function Stat({
  label,
  children,
  tone,
}: {
  label: string;
  children: React.ReactNode;
  tone?: number | null;
}) {
  const positive = tone == null ? null : tone > 0;
  return (
    <div>
      <div className="text-[10px] uppercase tracking-[0.14em] text-[var(--color-muted)] font-medium">
        {label}
      </div>
      <div
        className={clsx(
          "text-sm font-semibold tabular",
          positive === true && "text-[var(--color-up)]",
          positive === false && "text-[var(--color-down)]"
        )}
      >
        {children}
      </div>
    </div>
  );
}
