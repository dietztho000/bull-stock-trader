"use client";

import { useMemo, useState } from "react";
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import clsx from "clsx";
import type { ClosedTrade } from "@/lib/parsers/sectorLedger";
import { fmtMoney, fmtPct, fmtSignedMoney } from "@/lib/format";
import { sizingStatus } from "@/lib/stats/sizing";
import { Badge } from "@/components/ui/Card";
import { PostMortemButton } from "@/components/ai/PostMortemPopover";

export type ClosedTradeWithSizing = ClosedTrade & {
  score: number | null;
  targetPct: number | null;
  actualPct: number | null;
};

export function TradesTable({ trades }: { trades: ClosedTradeWithSizing[] }) {
  const [sorting, setSorting] = useState<SortingState>([
    { id: "date", desc: true },
  ]);
  const [sectorFilter, setSectorFilter] = useState("");
  const [outcomeFilter, setOutcomeFilter] = useState("");

  const sectors = useMemo(
    () => Array.from(new Set(trades.map((t) => t.sector).filter(Boolean))).sort(),
    [trades]
  );

  const filtered = useMemo(() => {
    return trades.filter(
      (t) =>
        (!sectorFilter || t.sector === sectorFilter) &&
        (!outcomeFilter || t.outcome === outcomeFilter)
    );
  }, [trades, sectorFilter, outcomeFilter]);

  const columns = useMemo<ColumnDef<ClosedTradeWithSizing>[]>(
    () => [
      { accessorKey: "date", header: "Date" },
      { accessorKey: "symbol", header: "Ticker" },
      { accessorKey: "sector", header: "Sector" },
      { accessorKey: "side", header: "Side" },
      {
        accessorKey: "entry",
        header: "Entry",
        cell: (c) => fmtMoney(c.getValue<number | null>()),
      },
      {
        accessorKey: "exit",
        header: "Exit",
        cell: (c) => fmtMoney(c.getValue<number | null>()),
      },
      {
        accessorKey: "pnl",
        header: "P&L",
        cell: (c) => {
          const v = c.getValue<number | null>();
          return (
            <span
              className={clsx(
                v == null && "text-[var(--color-muted)]",
                v != null && v > 0 && "text-[var(--color-up)]",
                v != null && v < 0 && "text-[var(--color-down)]"
              )}
            >
              {fmtSignedMoney(v)}
            </span>
          );
        },
      },
      {
        accessorKey: "pnlPct",
        header: "%",
        cell: (c) => {
          const v = c.getValue<number | null>();
          return (
            <span
              className={clsx(
                v != null && v > 0 && "text-[var(--color-up)]",
                v != null && v < 0 && "text-[var(--color-down)]"
              )}
            >
              {fmtPct(v)}
            </span>
          );
        },
      },
      { accessorKey: "outcome", header: "W/L" },
      {
        id: "sizing",
        header: "Sizing (actual / target)",
        cell: ({ row }) => {
          const r = row.original;
          if (r.targetPct == null) {
            return <span className="text-[var(--color-muted)]">—</span>;
          }
          const targetStr = `${(r.targetPct * 100).toFixed(0)}%`;
          if (r.actualPct == null) {
            return (
              <span className="text-[var(--color-muted)]">
                — / {targetStr} (score {r.score ?? "?"})
              </span>
            );
          }
          const actualStr = `${(r.actualPct * 100).toFixed(1)}%`;
          const status = sizingStatus(r.actualPct, r.targetPct);
          if (status === "over") {
            return (
              <Badge tone="down">
                {actualStr} / {targetStr}
              </Badge>
            );
          }
          return (
            <span className="tabular text-[var(--color-muted)]">
              {actualStr} / {targetStr}{" "}
              <span className="text-[10px] opacity-70">(score {r.score})</span>
            </span>
          );
        },
      },
      { accessorKey: "notes", header: "Notes" },
      {
        id: "ai",
        header: "AI",
        cell: ({ row }) => (
          <PostMortemButton
            symbol={row.original.symbol}
            entryDate={row.original.date || null}
          />
        ),
      },
    ],
    []
  );

  const table = useReactTable({
    data: filtered,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  if (!trades.length) {
    return (
      <div className="text-sm text-[var(--color-muted)]">
        No closed trades yet — table will populate as the bot closes positions.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <select
          className="bg-[var(--color-panel-2)] border border-[var(--color-border)] rounded px-2 py-1"
          value={sectorFilter}
          onChange={(e) => setSectorFilter(e.target.value)}
        >
          <option value="">All sectors</option>
          {sectors.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select
          className="bg-[var(--color-panel-2)] border border-[var(--color-border)] rounded px-2 py-1"
          value={outcomeFilter}
          onChange={(e) => setOutcomeFilter(e.target.value)}
        >
          <option value="">All outcomes</option>
          <option value="W">Wins</option>
          <option value="L">Losses</option>
          <option value="B">Breakeven</option>
        </select>
        <span className="text-[var(--color-muted)]">
          {filtered.length} / {trades.length} trades
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm tabular">
          <thead>
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id} className="text-left text-[11px] uppercase tracking-wider text-[var(--color-muted)] border-b border-[var(--color-border)]">
                {hg.headers.map((h) => (
                  <th
                    key={h.id}
                    onClick={h.column.getToggleSortingHandler()}
                    className="py-2 pr-3 cursor-pointer select-none"
                  >
                    {flexRender(h.column.columnDef.header, h.getContext())}
                    {h.column.getIsSorted() === "asc" && " ↑"}
                    {h.column.getIsSorted() === "desc" && " ↓"}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((r) => (
              <tr key={r.id} className="border-b border-[var(--color-border)]/40">
                {r.getVisibleCells().map((c) => (
                  <td key={c.id} className="py-1.5 pr-3 align-top">
                    {flexRender(c.column.columnDef.cell, c.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
