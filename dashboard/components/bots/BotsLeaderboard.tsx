"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import clsx from "clsx";
import Link from "next/link";
import { Card, Badge } from "@/components/ui/Card";
import { fmtMoney, fmtPct, fmtSignedMoney, colorOf } from "@/lib/format";
import type { LeaderboardRow } from "@/app/api/bots/leaderboard/route";
import { useLiveSwr } from "@/lib/useLiveSwr";
import { useMarketIsOpen } from "@/lib/useMarketIsOpen";
import { HealthDot } from "./HealthDot";

const fetcher = (u: string) => fetch(u).then((r) => r.json());

type SortKey =
  | "name"
  | "mode"
  | "equity"
  | "dayPct"
  | "phaseAlphaPct"
  | "tradesThisWeek"
  | "maxDrawdownPct";

type SortDir = "asc" | "desc";

const COLUMNS: Array<{ key: SortKey; label: string; align: "left" | "right" }> = [
  { key: "name", label: "Bot", align: "left" },
  { key: "mode", label: "Mode", align: "left" },
  { key: "equity", label: "Equity", align: "right" },
  { key: "dayPct", label: "Day", align: "right" },
  { key: "phaseAlphaPct", label: "Alpha vs SPY", align: "right" },
  { key: "tradesThisWeek", label: "Trades / wk", align: "right" },
  { key: "maxDrawdownPct", label: "Max DD", align: "right" },
];

function compareNullable(
  a: number | null | undefined,
  b: number | null | undefined,
  dir: SortDir
): number {
  // nulls sort to the bottom regardless of direction.
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  return dir === "asc" ? a - b : b - a;
}

export function BotsLeaderboard() {
  // useLiveSwr already clamps to a 60s floor when the market is closed,
  // but bot equity barely moves after-hours — pause polling entirely when
  // the market is closed so 5 enabled bots don't fan out 5 Alpaca shells
  // per minute all night. Focus revalidation still updates the panel when
  // the user comes back to the tab.
  const liveOpts = useLiveSwr(60_000);
  const marketOpen = useMarketIsOpen();
  const { data, error, isLoading } = useSWR<{ rows: LeaderboardRow[] }>(
    "/api/bots/leaderboard",
    fetcher,
    {
      ...liveOpts,
      refreshInterval: marketOpen === false ? 0 : liveOpts.refreshInterval,
      keepPreviousData: true,
    }
  );

  const [sortKey, setSortKey] = useState<SortKey>("equity");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const rows = data?.rows ?? [];
  const sortedRows = useMemo(() => {
    const copy = rows.slice();
    copy.sort((a, b) => {
      switch (sortKey) {
        case "name":
          return sortDir === "asc"
            ? a.name.localeCompare(b.name)
            : b.name.localeCompare(a.name);
        case "mode": {
          // Group by mode, then by name within each group.
          if (a.mode !== b.mode) {
            const live = sortDir === "asc" ? "live" : "paper";
            return a.mode === live ? -1 : 1;
          }
          return a.name.localeCompare(b.name);
        }
        default:
          return compareNullable(a[sortKey], b[sortKey], sortDir);
      }
    });
    return copy;
  }, [rows, sortKey, sortDir]);

  function setSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      // Numeric columns default to descending (best first); name defaults to asc.
      setSortDir(key === "name" || key === "mode" ? "asc" : "desc");
    }
  }

  if (isLoading && !data) {
    return (
      <Card title="Leaderboard" subtitle="Loading…">
        <div className="text-xs text-[var(--color-muted)]">
          Fetching live equity for every bot…
        </div>
      </Card>
    );
  }
  if (error) {
    return (
      <Card title="Leaderboard">
        <div className="text-xs text-[var(--color-down)]">
          Failed to load: {error instanceof Error ? error.message : String(error)}
        </div>
      </Card>
    );
  }
  if (rows.length === 0) {
    return null;
  }

  return (
    <Card
      title="Leaderboard"
      subtitle={`${rows.length} bot${rows.length === 1 ? "" : "s"} · refresh 60s · sort by clicking a column`}
      right={
        <Link
          href="/bots/compare"
          className="text-[11px] text-[var(--color-accent)] hover:underline"
        >
          Side-by-side →
        </Link>
      }
    >
      <div className="overflow-x-auto">
        <table className="w-full text-sm tabular">
          <thead>
            <tr className="text-[10px] uppercase tracking-[0.14em] text-[var(--color-muted)] border-b border-[rgba(255,255,255,0.06)]">
              {COLUMNS.map((c) => {
                const active = sortKey === c.key;
                const arrow = active ? (sortDir === "asc" ? " ▲" : " ▼") : "";
                return (
                  <th
                    key={c.key}
                    onClick={() => setSort(c.key)}
                    className={clsx(
                      "py-2 px-2 cursor-pointer select-none hover:text-[var(--color-text)]",
                      c.align === "right" ? "text-right" : "text-left",
                      active && "text-[var(--color-text)]"
                    )}
                  >
                    {c.label}
                    {arrow}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {sortedRows.map((r) => (
              <tr
                key={r.botId}
                className={clsx(
                  "border-b border-[rgba(255,255,255,0.04)]",
                  !r.enabled && "opacity-50"
                )}
              >
                <td className="py-2 px-2">
                  <div className="flex items-center gap-1.5">
                    <HealthDot botId={r.botId} />
                    <Link
                      href={`/?bot=${encodeURIComponent(r.botId)}`}
                      className="font-semibold hover:text-[var(--color-accent)]"
                    >
                      {r.name}
                    </Link>
                  </div>
                  <div className="text-[10px] text-[var(--color-muted)] font-mono truncate">
                    {r.botId}
                    {r.allocation != null && (
                      <>
                        {" · "}
                        {r.allocation.toLocaleString("en-US", {
                          style: "currency",
                          currency: "USD",
                          maximumFractionDigits: 0,
                        })}{" "}
                        slice
                      </>
                    )}
                  </div>
                </td>
                <td className="py-2 px-2">
                  <Badge tone={r.mode === "live" ? "down" : "warn"}>{r.mode}</Badge>
                  {!r.enabled && (
                    <span className="ml-1 text-[10px] text-[var(--color-muted)]">disabled</span>
                  )}
                </td>
                <td className="py-2 px-2 text-right">
                  {r.equity != null ? (
                    <>
                      <div>{fmtMoney(r.equity)}</div>
                      {r.unrealizedPl != null && r.unrealizedPl !== 0 && (
                        <div
                          className={clsx(
                            "text-[10px]",
                            colorOf(r.unrealizedPl) === true && "text-[var(--color-up)]",
                            colorOf(r.unrealizedPl) === false && "text-[var(--color-down)]"
                          )}
                        >
                          {fmtSignedMoney(r.unrealizedPl)} unreal
                        </div>
                      )}
                    </>
                  ) : (
                    <span className="text-[var(--color-muted)]">—</span>
                  )}
                </td>
                <td
                  className={clsx(
                    "py-2 px-2 text-right",
                    r.dayPct != null && r.dayPct > 0 && "text-[var(--color-up)]",
                    r.dayPct != null && r.dayPct < 0 && "text-[var(--color-down)]"
                  )}
                >
                  {r.dayPct != null ? fmtPct(r.dayPct) : "—"}
                </td>
                <td
                  className={clsx(
                    "py-2 px-2 text-right",
                    r.phaseAlphaPct != null && r.phaseAlphaPct > 0 && "text-[var(--color-up)]",
                    r.phaseAlphaPct != null && r.phaseAlphaPct < 0 && "text-[var(--color-down)]"
                  )}
                >
                  {r.phaseAlphaPct != null ? fmtPct(r.phaseAlphaPct) : "—"}
                </td>
                <td className="py-2 px-2 text-right">{r.tradesThisWeek}</td>
                <td
                  className={clsx(
                    "py-2 px-2 text-right",
                    r.maxDrawdownPct != null && r.maxDrawdownPct < -0.05 && "text-[var(--color-warn)]",
                    r.maxDrawdownPct != null && r.maxDrawdownPct < -0.1 && "text-[var(--color-down)]"
                  )}
                >
                  {r.maxDrawdownPct != null ? fmtPct(r.maxDrawdownPct * 100) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {sortedRows.some((r) => r.error) && (
        <div className="mt-3 text-[10px] text-[var(--color-muted)]">
          Some rows have upstream errors:
          <ul className="list-disc list-inside mt-1 space-y-0.5">
            {sortedRows
              .filter((r) => r.error)
              .map((r) => (
                <li key={r.botId} className="break-all">
                  <span className="font-mono">{r.botId}</span>: {r.error}
                </li>
              ))}
          </ul>
        </div>
      )}
    </Card>
  );
}
