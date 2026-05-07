"use client";

// NEW 2026-05-06 (further enhancement P2): "Tech-heavy week" sparkbar.
// Counts upcoming-week earnings by GICS sector and renders a horizontal
// stacked bar so the user sees concentration at a glance. Pure derived
// view — no new memory files. Quietly hidden if the sectorMap is empty
// (e.g. fresh repo where SECTOR-MAP.md hasn't been built yet).

import clsx from "clsx";
import { Card } from "@/components/ui/Card";
import type { CalendarEvent } from "@/lib/calendar/events";

type Props = {
  events: CalendarEvent[];
  sectorMap: Map<string, string>;
  fromIso: string;
  toIso: string;
};

const UNKNOWN = "—";

export function SectorWeekStrip({ events, sectorMap, fromIso, toIso }: Props) {
  if (sectorMap.size === 0) return null;
  const counts = new Map<string, number>();
  let total = 0;
  for (const e of events) {
    if (e.kind !== "earnings") continue;
    if (e.date < fromIso || e.date > toIso) continue;
    const sym = e.entry.symbol.toUpperCase();
    const sector = sectorMap.get(sym) || UNKNOWN;
    counts.set(sector, (counts.get(sector) ?? 0) + 1);
    total += 1;
  }
  if (total === 0) return null;

  const sorted = Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .filter(([sector]) => sector !== UNKNOWN || counts.size === 1);

  return (
    <Card
      title="Earnings by sector — next 7 days"
      subtitle={`${total} earnings ${formatRange(fromIso, toIso)}`}
    >
      <div className="flex h-3 rounded overflow-hidden border border-[var(--color-border)]">
        {sorted.map(([sector, count], i) => {
          const pct = (count / total) * 100;
          return (
            <div
              key={sector}
              title={`${sector}: ${count} (${pct.toFixed(0)}%)`}
              className={clsx("h-full", barColor(i))}
              style={{ width: `${pct}%` }}
            />
          );
        })}
      </div>
      <ul className="mt-2 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-3 gap-y-1 text-xs">
        {sorted.map(([sector, count], i) => (
          <li
            key={sector}
            className="flex items-center gap-1.5 text-[var(--color-muted)] tabular truncate"
          >
            <span
              className={clsx(
                "size-2 rounded-sm shrink-0",
                barColor(i)
              )}
            />
            <span className="truncate text-[var(--color-text)]">{sector}</span>
            <span className="ml-auto tabular shrink-0">{count}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

// Sector-agnostic palette — each band is a different color-mix tint of
// the primary text color, ranging from the brand accent through up/warn/
// down. Top-N gets the brightest tints so the highest-concentration
// sectors stand out.
function barColor(idx: number): string {
  const palette = [
    "bg-[color-mix(in_oklch,var(--color-accent)_70%,transparent)]",
    "bg-[color-mix(in_oklch,var(--color-up)_70%,transparent)]",
    "bg-[color-mix(in_oklch,var(--color-warn)_70%,transparent)]",
    "bg-[color-mix(in_oklch,var(--color-down)_55%,transparent)]",
    "bg-[color-mix(in_oklch,var(--color-accent)_45%,transparent)]",
    "bg-[color-mix(in_oklch,var(--color-up)_45%,transparent)]",
    "bg-[color-mix(in_oklch,var(--color-warn)_45%,transparent)]",
    "bg-[color-mix(in_oklch,var(--color-muted)_55%,transparent)]",
  ];
  return palette[idx % palette.length];
}

function formatRange(from: string, to: string): string {
  return `(${from} → ${to})`;
}
