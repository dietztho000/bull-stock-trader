"use client";

import clsx from "clsx";
import { motion } from "framer-motion";
import type { ReactNode } from "react";

export type MeterTone = "up" | "down" | "warn" | "accent";

const TONE_CLASS: Record<MeterTone, string> = {
  up: "bg-[var(--color-up)]",
  down: "bg-[var(--color-down)]",
  warn: "bg-[var(--color-warn)]",
  accent: "bg-[var(--color-accent)]",
};

export function MoodMeter({
  label,
  value,
  display,
  tone,
  hint,
}: {
  label: string;
  value: number | null; // 0-100, or null when unknown
  display: ReactNode;
  tone: MeterTone;
  hint?: ReactNode;
}) {
  const pct = value == null ? 0 : Math.max(0, Math.min(100, value));
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2 mb-1">
        <span className="text-[10px] uppercase tracking-[0.14em] text-[var(--color-muted)] font-medium">
          {label}
        </span>
        <span className="text-xs tabular font-semibold text-[var(--color-text)]">
          {display}
        </span>
      </div>
      <div className="relative h-1.5 rounded-full overflow-hidden bg-[rgba(255,255,255,0.07)]">
        <motion.div
          className={clsx("absolute inset-y-0 left-0 rounded-full", TONE_CLASS[tone])}
          initial={false}
          animate={{ width: value == null ? "0%" : `${pct}%`, opacity: value == null ? 0.3 : 1 }}
          transition={{ type: "spring", stiffness: 180, damping: 24 }}
        />
      </div>
      {hint && (
        <div className="mt-1 text-[10px] text-[var(--color-muted)]">{hint}</div>
      )}
    </div>
  );
}

export function MoodMetersGroup({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-1 gap-3">{children}</div>;
}
