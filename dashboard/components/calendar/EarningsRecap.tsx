"use client";

// NEW 2026-05-06 (further enhancement P2): last-7-days earnings recap.
// Counts beats/misses/in-line based on actualEps vs epsEstimate, plus
// the average post-print 1-day move. Hidden if no past rows have
// results back-filled yet. Pure derived view — no new memory files.

import clsx from "clsx";
import { Card } from "@/components/ui/Card";
import type { EarningsEntry } from "@/lib/parsers/earningsCalendar.shared";

type Props = {
  earnings: EarningsEntry[];
  todayIso: string;
};

export function EarningsRecap({ earnings, todayIso }: Props) {
  const fromIso = addDaysIso(todayIso, -7);
  const recent = earnings.filter(
    (e) => e.date >= fromIso && e.date < todayIso && e.actualEps
  );
  if (recent.length === 0) return null;

  let beats = 0;
  let misses = 0;
  let inline = 0;
  const moves: number[] = [];
  for (const e of recent) {
    const actual = parseEps(e.actualEps);
    const est = parseEps(e.epsEstimate);
    if (actual != null && est != null) {
      // Round to 2dp to ignore noise; >2¢ is a beat / miss.
      const delta = actual - est;
      if (delta > 0.005) beats += 1;
      else if (delta < -0.005) misses += 1;
      else inline += 1;
    }
    const move = parsePct(e.postPrintMovePct);
    if (move != null) moves.push(move);
  }
  const avgMove =
    moves.length > 0 ? moves.reduce((a, b) => a + b, 0) / moves.length : null;
  const movePos = moves.filter((m) => m > 0).length;
  const moveNeg = moves.length - movePos;

  return (
    <Card
      title="Last 7 days — earnings recap"
      subtitle={`${recent.length} prints with results back-filled`}
    >
      <div className="grid grid-cols-3 gap-4">
        <Stat label="Beat" value={beats} tone="up" />
        <Stat label="Miss" value={misses} tone="down" />
        <Stat label="In-line" value={inline} tone="neutral" />
      </div>
      {avgMove != null && (
        <div className="mt-3 pt-3 border-t border-[var(--color-border)] flex flex-wrap items-baseline gap-x-4 gap-y-1 text-xs">
          <div className="flex items-baseline gap-1.5">
            <span className="text-[10px] uppercase tracking-wider text-[var(--color-muted)]">
              Avg 1-day move
            </span>
            <span
              className={clsx(
                "tabular font-semibold",
                avgMove >= 0
                  ? "text-[var(--color-up)]"
                  : "text-[var(--color-down)]"
              )}
            >
              {avgMove >= 0 ? "+" : ""}
              {avgMove.toFixed(2)}%
            </span>
          </div>
          <div className="text-[var(--color-muted)] tabular">
            <span className="text-[var(--color-up)]">{movePos}</span> up ·{" "}
            <span className="text-[var(--color-down)]">{moveNeg}</span> down
          </div>
        </div>
      )}
    </Card>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "up" | "down" | "neutral";
}) {
  const colorCls =
    tone === "up"
      ? "text-[var(--color-up)]"
      : tone === "down"
      ? "text-[var(--color-down)]"
      : "text-[var(--color-text)]";
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] uppercase tracking-wider text-[var(--color-muted)]">
        {label}
      </span>
      <span className={clsx("text-xl font-semibold tabular", colorCls)}>
        {value}
      </span>
    </div>
  );
}

function parseEps(s: string | undefined): number | null {
  if (!s) return null;
  const cleaned = s
    .replace(/\$/g, "")
    .replace(/,/g, "")
    .replace(/^\((.*)\)$/, "-$1")
    .trim();
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function parsePct(s: string | undefined): number | null {
  if (!s) return null;
  const cleaned = s.replace(/[^\d.+-]/g, "");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function addDaysIso(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
