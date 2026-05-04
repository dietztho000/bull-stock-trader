"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import clsx from "clsx";
import { Card, Badge } from "@/components/ui/Card";
import { fmtMoney, fmtRelativeTime, fmtSignedMoney } from "@/lib/format";
import type {
  BacktestSnapshot,
  BacktestSnapshotMeta,
} from "@/lib/backtest/cache";

const fetcher = (u: string) => fetch(u).then((r) => r.json());

type SnapshotsResp = {
  botId: string;
  strategy: string;
  snapshots: BacktestSnapshotMeta[];
};

type SnapshotResp = {
  botId: string;
  strategy: string;
  id: string;
  snapshot: BacktestSnapshot;
};

/** Audit F4 — lists every retained backtest snapshot for the active bot
 *  and lets the user pick TWO to compare side-by-side. The comparison is
 *  a metric grid + a per-trade row diff highlighting where the two runs
 *  reached different exits. Both snapshots come from the same bot's
 *  memory dir, so trade IDs line up by `${symbol}@${entryDate}`. */
export function BacktestSnapshotCompare({ botId }: { botId: string }) {
  const list = useSWR<SnapshotsResp>(
    `/api/backtest/snapshots?bot=${encodeURIComponent(botId)}`,
    fetcher,
    { revalidateOnFocus: false }
  );

  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  function toggle(id: string) {
    setSelectedIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      // Cap at 2; the second click on a third snapshot bumps the oldest off.
      const next = [...prev, id];
      return next.slice(-2);
    });
  }

  function clear() {
    setSelectedIds([]);
  }

  const snapshots = list.data?.snapshots ?? [];

  if (list.isLoading && !list.data) {
    return (
      <Card title="Backtest snapshots" subtitle="Loading…">
        <div className="text-xs text-[var(--color-muted)]">
          Reading retained snapshots…
        </div>
      </Card>
    );
  }
  if (list.error) {
    return (
      <Card title="Backtest snapshots">
        <div className="text-xs text-[var(--color-down)]">
          Failed to load:{" "}
          {list.error instanceof Error
            ? list.error.message
            : String(list.error)}
        </div>
      </Card>
    );
  }
  if (snapshots.length === 0) {
    return (
      <Card title="Backtest snapshots">
        <div className="text-xs text-[var(--color-muted)]">
          No snapshots retained yet — the next backtest run will save one. The
          existing latest-run table above stays as the canonical view; this
          panel becomes useful once you&apos;ve run a few experiments.
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card
        title="Backtest snapshots"
        subtitle={`${snapshots.length} retained · click two to compare`}
        right={
          selectedIds.length > 0 ? (
            <button
              type="button"
              onClick={clear}
              className="text-[11px] text-[var(--color-muted)] hover:text-[var(--color-text)] underline underline-offset-2"
            >
              Clear selection
            </button>
          ) : null
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full text-xs tabular">
            <thead>
              <tr className="text-left text-[10px] uppercase tracking-[0.14em] text-[var(--color-muted)] border-b border-[rgba(255,255,255,0.06)]">
                <th className="py-2 pr-2 w-8">Pick</th>
                <th className="py-2 pr-3">Saved</th>
                <th className="py-2 pr-3">Run date</th>
                <th className="py-2 pr-3 text-right">Trades</th>
                <th className="py-2 pr-3 text-right">Actual P&amp;L</th>
                <th className="py-2 pr-3 text-right">Sim P&amp;L</th>
                <th className="py-2 pr-3 text-right">Delta</th>
                <th className="py-2 pr-3 text-right">Ladder</th>
                <th className="py-2 pr-3">Strategy src</th>
                <th className="py-2 pr-3">Overrides</th>
              </tr>
            </thead>
            <tbody>
              {snapshots.map((s) => {
                const picked = selectedIds.includes(s.id);
                const overrides = s.strategyParamsUsed ?? {};
                const overrideKeys = Object.keys(overrides);
                return (
                  <tr
                    key={s.id}
                    onClick={() => toggle(s.id)}
                    className={clsx(
                      "border-b border-[rgba(255,255,255,0.04)] cursor-pointer hover:bg-[rgba(255,255,255,0.02)]",
                      picked && "bg-[var(--color-accent)]/10"
                    )}
                  >
                    <td className="py-1.5 pr-2">
                      <input
                        type="checkbox"
                        readOnly
                        checked={picked}
                        className="accent-[var(--color-accent)]"
                      />
                    </td>
                    <td
                      className="py-1.5 pr-3 text-[var(--color-muted)]"
                      title={new Date(s.savedAt).toISOString()}
                    >
                      {s.savedAt
                        ? `${fmtRelativeTime(s.savedAt)} ago`
                        : "—"}
                    </td>
                    <td className="py-1.5 pr-3 font-mono text-[11px]">
                      {s.runDate}
                    </td>
                    <td className="py-1.5 pr-3 text-right">{s.tradeCount}</td>
                    <td className="py-1.5 pr-3 text-right">
                      {fmtSignedMoney(s.totalActualPnl)}
                    </td>
                    <td className="py-1.5 pr-3 text-right">
                      {fmtSignedMoney(s.totalSimPnl)}
                    </td>
                    <td
                      className={clsx(
                        "py-1.5 pr-3 text-right font-semibold",
                        s.pnlDelta > 0 && "text-[var(--color-up)]",
                        s.pnlDelta < 0 && "text-[var(--color-down)]"
                      )}
                    >
                      {fmtSignedMoney(s.pnlDelta)}
                    </td>
                    <td className="py-1.5 pr-3 text-right">
                      {(s.ladderFireRate * 100).toFixed(0)}%
                    </td>
                    <td className="py-1.5 pr-3 text-[10px] text-[var(--color-muted)] font-mono">
                      {s.strategySourceBot ?? "—"}
                    </td>
                    <td className="py-1.5 pr-3 text-[10px] text-[var(--color-muted)]">
                      {overrideKeys.length === 0 ? (
                        "default"
                      ) : (
                        <span title={JSON.stringify(overrides, null, 2)}>
                          {overrideKeys.length} override
                          {overrideKeys.length === 1 ? "" : "s"}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {selectedIds.length === 1 && (
          <div className="mt-3 text-[11px] text-[var(--color-muted)]">
            Pick one more snapshot to compare against{" "}
            <code className="font-mono">{selectedIds[0]}</code>.
          </div>
        )}
      </Card>

      {selectedIds.length === 2 && (
        <CompareView
          botId={botId}
          aId={selectedIds[0]}
          bId={selectedIds[1]}
        />
      )}
    </div>
  );
}

function CompareView({
  botId,
  aId,
  bId,
}: {
  botId: string;
  aId: string;
  bId: string;
}) {
  const aResp = useSWR<SnapshotResp>(
    `/api/backtest/snapshot/${encodeURIComponent(aId)}?bot=${encodeURIComponent(botId)}`,
    fetcher,
    { revalidateOnFocus: false }
  );
  const bResp = useSWR<SnapshotResp>(
    `/api/backtest/snapshot/${encodeURIComponent(bId)}?bot=${encodeURIComponent(botId)}`,
    fetcher,
    { revalidateOnFocus: false }
  );

  const a = aResp.data?.snapshot;
  const b = bResp.data?.snapshot;
  const tradeDiffs = useMemo(() => {
    if (!a || !b) return [];
    return diffTrades(a, b);
  }, [a, b]);

  if (aResp.isLoading || bResp.isLoading) {
    return (
      <Card title="Compare" subtitle="Loading both snapshots…">
        <div className="text-xs text-[var(--color-muted)]">…</div>
      </Card>
    );
  }
  if (!a || !b) {
    return (
      <Card title="Compare">
        <div className="text-xs text-[var(--color-down)]">
          One or both snapshots failed to load.
        </div>
      </Card>
    );
  }

  return (
    <Card
      title={`Compare: ${aId} vs ${bId}`}
      subtitle={`${a.summary.tradeCount} vs ${b.summary.tradeCount} trades · differences highlighted below`}
    >
      <div className="grid sm:grid-cols-3 gap-3 mb-4">
        <MetricCell
          label="Sim P&L"
          aValue={a.summary.totalSimPnl}
          bValue={b.summary.totalSimPnl}
          fmt={fmtSignedMoney}
        />
        <MetricCell
          label="Sim − Actual delta"
          aValue={a.summary.pnlDelta}
          bValue={b.summary.pnlDelta}
          fmt={fmtSignedMoney}
        />
        <MetricCell
          label="Ladder fire rate"
          aValue={a.summary.ladderFireRate * 100}
          bValue={b.summary.ladderFireRate * 100}
          fmt={(n) => `${n.toFixed(0)}%`}
        />
      </div>

      <ParamDiff
        aParams={a.summary.strategyParamsUsed ?? null}
        bParams={b.summary.strategyParamsUsed ?? null}
      />

      {tradeDiffs.length === 0 ? (
        <div className="mt-4 text-xs text-[var(--color-muted)]">
          🟢 Same exit decision on every trade — only the headline numbers
          differ (likely from a small parameter tweak that didn&apos;t change
          any individual exit).
        </div>
      ) : (
        <div className="mt-4">
          <div className="text-[10px] uppercase tracking-[0.14em] text-[var(--color-muted)] font-semibold mb-2">
            Trades that exited differently ({tradeDiffs.length})
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs tabular">
              <thead>
                <tr className="text-left text-[10px] uppercase tracking-[0.14em] text-[var(--color-muted)] border-b border-[rgba(255,255,255,0.06)]">
                  <th className="py-2 pr-3">Trade</th>
                  <th className="py-2 pr-3">A reason</th>
                  <th className="py-2 pr-3 text-right">A P&amp;L</th>
                  <th className="py-2 pr-3">B reason</th>
                  <th className="py-2 pr-3 text-right">B P&amp;L</th>
                  <th className="py-2 pr-3 text-right">Δ</th>
                </tr>
              </thead>
              <tbody>
                {tradeDiffs.map((d) => (
                  <tr
                    key={d.key}
                    className="border-b border-[rgba(255,255,255,0.04)]"
                  >
                    <td className="py-1.5 pr-3 font-mono text-[11px]">
                      {d.key}
                    </td>
                    <td className="py-1.5 pr-3 text-[11px]">
                      <Badge tone={toneFor(d.aReason)}>{d.aReason}</Badge>
                    </td>
                    <td className="py-1.5 pr-3 text-right">
                      {d.aPnl != null ? fmtMoney(d.aPnl) : "—"}
                    </td>
                    <td className="py-1.5 pr-3 text-[11px]">
                      <Badge tone={toneFor(d.bReason)}>{d.bReason}</Badge>
                    </td>
                    <td className="py-1.5 pr-3 text-right">
                      {d.bPnl != null ? fmtMoney(d.bPnl) : "—"}
                    </td>
                    <td
                      className={clsx(
                        "py-1.5 pr-3 text-right font-semibold",
                        d.delta != null && d.delta > 0 && "text-[var(--color-up)]",
                        d.delta != null && d.delta < 0 && "text-[var(--color-down)]"
                      )}
                    >
                      {d.delta != null ? fmtSignedMoney(d.delta) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </Card>
  );
}

function MetricCell({
  label,
  aValue,
  bValue,
  fmt,
}: {
  label: string;
  aValue: number;
  bValue: number;
  fmt: (n: number) => string;
}) {
  const delta = bValue - aValue;
  return (
    <div className="rounded-lg border border-[rgba(255,255,255,0.06)] p-3">
      <div className="text-[10px] uppercase tracking-[0.14em] text-[var(--color-muted)] font-semibold">
        {label}
      </div>
      <div className="mt-1 grid grid-cols-2 gap-2 items-baseline">
        <div>
          <div className="text-[10px] text-[var(--color-muted)]">A</div>
          <div className="text-sm font-semibold tabular">{fmt(aValue)}</div>
        </div>
        <div>
          <div className="text-[10px] text-[var(--color-muted)]">B</div>
          <div className="text-sm font-semibold tabular">{fmt(bValue)}</div>
        </div>
      </div>
      <div
        className={clsx(
          "text-[10px] tabular mt-1",
          delta > 0 && "text-[var(--color-up)]",
          delta < 0 && "text-[var(--color-down)]",
          delta === 0 && "text-[var(--color-muted)]"
        )}
      >
        Δ {delta > 0 ? "+" : ""}
        {fmt(delta)}
      </div>
    </div>
  );
}

function ParamDiff({
  aParams,
  bParams,
}: {
  aParams: Record<string, number> | null;
  bParams: Record<string, number> | null;
}) {
  const allKeys = new Set([
    ...Object.keys(aParams ?? {}),
    ...Object.keys(bParams ?? {}),
  ]);
  if (allKeys.size === 0) return null;
  const rows = Array.from(allKeys)
    .map((k) => ({
      key: k,
      a: aParams?.[k] ?? null,
      b: bParams?.[k] ?? null,
    }))
    .filter((r) => r.a !== r.b);
  if (rows.length === 0) return null;

  return (
    <div className="rounded-lg border border-[rgba(255,255,255,0.06)] p-3">
      <div className="text-[10px] uppercase tracking-[0.14em] text-[var(--color-muted)] font-semibold mb-2">
        Param differences
      </div>
      <table className="w-full text-xs tabular">
        <tbody>
          {rows.map((r) => (
            <tr
              key={r.key}
              className="border-b border-[rgba(255,255,255,0.04)] last:border-0"
            >
              <td className="py-1 pr-3 font-mono text-[11px] text-[var(--color-muted)]">
                {r.key}
              </td>
              <td className="py-1 pr-3 text-right">
                {r.a == null ? <em>default</em> : r.a}
              </td>
              <td className="py-1 pr-3 text-[var(--color-muted)] text-center">
                →
              </td>
              <td className="py-1 pr-3 text-right">
                {r.b == null ? <em>default</em> : r.b}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function toneFor(reason: string): "up" | "down" | "warn" | "neutral" {
  switch (reason) {
    case "stop_limit":
    case "gap_exit":
    case "gap_exit_no_fill":
    case "earnings_exit":
      return "down";
    case "trailing_stop":
      return "up";
    case "still_open":
      return "warn";
    default:
      return "neutral";
  }
}

type TradeDiffRow = {
  key: string;
  aReason: string;
  bReason: string;
  aPnl: number | null;
  bPnl: number | null;
  delta: number | null;
};

function diffTrades(a: BacktestSnapshot, b: BacktestSnapshot): TradeDiffRow[] {
  const aIndex = new Map(
    a.results.map((r) => [`${r.symbol}@${r.entryDate}`, r])
  );
  const bIndex = new Map(
    b.results.map((r) => [`${r.symbol}@${r.entryDate}`, r])
  );
  const out: TradeDiffRow[] = [];
  const allKeys = new Set([...aIndex.keys(), ...bIndex.keys()]);
  for (const key of allKeys) {
    const ar = aIndex.get(key);
    const br = bIndex.get(key);
    const aReason = ar?.simExitReason ?? "absent";
    const bReason = br?.simExitReason ?? "absent";
    const aPnl = ar?.simPnl ?? null;
    const bPnl = br?.simPnl ?? null;
    const reasonsDiffer = aReason !== bReason;
    const pnlDiffers =
      aPnl != null && bPnl != null && Math.abs(aPnl - bPnl) > 0.005;
    if (!reasonsDiffer && !pnlDiffers) continue;
    out.push({
      key,
      aReason,
      bReason,
      aPnl,
      bPnl,
      delta: aPnl != null && bPnl != null ? bPnl - aPnl : null,
    });
  }
  // Largest absolute P&L diff first — most actionable signal.
  out.sort((x, y) => Math.abs(y.delta ?? 0) - Math.abs(x.delta ?? 0));
  return out;
}

