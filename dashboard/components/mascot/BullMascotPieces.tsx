"use client";

import { motion } from "framer-motion";
import clsx from "clsx";
import type { LevelProgress } from "@/lib/mascot/level";

/** Glassy stat card with optional delta + tone. */
export function Stat({
  label,
  value,
  delta,
  hint,
  tone,
}: {
  label: string;
  value: string;
  delta?: string | null;
  hint?: string;
  tone: boolean | null;
}) {
  return (
    <div className="frost rounded-xl p-3">
      <div className="text-[10px] uppercase tracking-[0.14em] text-[var(--color-muted)] font-medium">
        {label}
      </div>
      <div className="mt-1 text-lg font-semibold tabular tracking-tight">{value}</div>
      {(delta || hint) && (
        <div className="mt-0.5 text-[11px] flex items-center gap-1.5">
          {delta && (
            <span
              className={clsx(
                "tabular font-medium",
                tone === true && "text-[var(--color-up)]",
                tone === false && "text-[var(--color-down)]",
                tone == null && "text-[var(--color-muted)]"
              )}
            >
              {delta}
            </span>
          )}
          {hint && <span className="text-[var(--color-muted)]">{hint}</span>}
        </div>
      )}
    </div>
  );
}

/** Animated 0–100 progress bar. Tone derives from the value (>=70 up,
 *  >=40 warn, else down). */
export function RiskBar({
  label,
  value,
  hint,
}: {
  label: string;
  value: number;
  hint?: string;
}) {
  const tone = value >= 70 ? "up" : value >= 40 ? "warn" : "down";
  const cls =
    tone === "up"
      ? "bg-[var(--color-up)]"
      : tone === "warn"
      ? "bg-[var(--color-warn)]"
      : "bg-[var(--color-down)]";
  return (
    <div>
      <div className="text-[10px] uppercase tracking-[0.14em] text-[var(--color-muted)] font-medium">
        {label}
      </div>
      <div className="mt-1 h-1.5 rounded-full overflow-hidden bg-[rgba(255,255,255,0.07)]">
        <motion.div
          className={clsx("h-full rounded-full", cls)}
          initial={{ width: 0 }}
          animate={{ width: `${Math.max(0, Math.min(100, value))}%` }}
          transition={{ type: "spring", stiffness: 180, damping: 22 }}
        />
      </div>
      {hint && <div className="mt-1 text-[10px] text-[var(--color-muted)]">{hint}</div>}
    </div>
  );
}

/** Tiny labeled value pair used by the career dossier. */
export function Career({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-[0.14em] text-[var(--color-muted)] font-medium">
        {label}
      </div>
      <div className="mt-0.5 text-base tabular font-semibold">{value}</div>
    </div>
  );
}

export function Sparkline({
  rows,
}: {
  rows: Array<{ date: string; portfolio: number | null }>;
}) {
  const points = rows
    .map((r) => r.portfolio)
    .filter((p): p is number => p != null);
  if (points.length < 2) return null;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const w = 320;
  const h = 56;
  const stepX = w / (points.length - 1);
  const path = points
    .map((p, i) => {
      const x = i * stepX;
      const y = h - ((p - min) / range) * h;
      return `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");
  const last = points[points.length - 1];
  const first = points[0];
  const tone = last >= first ? "var(--color-up)" : "var(--color-down)";
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="w-full h-14">
      <path
        d={path}
        fill="none"
        stroke={tone}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function LevelProgressBar({ progress }: { progress: LevelProgress }) {
  if (!progress.next) return null;
  return (
    <div className="mt-2 max-w-xs">
      <div className="flex items-baseline justify-between text-[10px] tabular text-[var(--color-muted)] mb-1">
        <span>
          Lvl {progress.current.level} → {progress.next.level} ({progress.next.title})
        </span>
        <span>{Math.round(progress.progressPct)}%</span>
      </div>
      <div className="h-1 rounded-full overflow-hidden bg-[rgba(255,255,255,0.07)]">
        <motion.div
          className="h-full rounded-full bg-[var(--color-accent)]"
          initial={false}
          animate={{ width: `${progress.progressPct}%` }}
          transition={{ type: "spring", stiffness: 180, damping: 24 }}
        />
      </div>
    </div>
  );
}
