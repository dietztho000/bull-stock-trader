"use client";

import clsx from "clsx";
import { motion, LayoutGroup } from "framer-motion";
import { fmtPct } from "@/lib/format";

const DAY_LIMIT = -2.0;
const WEEK_LIMIT = -4.0;
const SLOT_CAP = 6;

type Status = "ok" | "warn" | "tripped";

function statusFor(value: number | null, limit: number): Status {
  if (value == null) return "warn";
  if (value <= limit) return "tripped";
  if (value <= limit * 0.5) return "warn";
  return "ok";
}

function slotStatus(used: number | null): Status {
  if (used == null) return "warn";
  if (used >= SLOT_CAP) return "tripped";
  if (used >= SLOT_CAP - 1) return "warn";
  return "ok";
}

export function BreakerPills({
  dayPct,
  weekPct,
  slotsUsed,
}: {
  dayPct: number | null;
  weekPct: number | null;
  slotsUsed: number | null;
}) {
  return (
    <LayoutGroup id="breaker-pills">
      <div className="flex flex-wrap items-center gap-2.5">
        <span className="text-[10px] uppercase tracking-[0.16em] text-[var(--color-muted)] font-semibold mr-1">
          Circuit breakers
        </span>
        <Pill
          id="day"
          label="Day"
          value={dayPct != null ? fmtPct(dayPct) : "—"}
          limitLabel={`limit ${DAY_LIMIT.toFixed(0)}%`}
          status={statusFor(dayPct, DAY_LIMIT)}
        />
        <Pill
          id="week"
          label="Week"
          value={weekPct != null ? fmtPct(weekPct) : "—"}
          limitLabel={`limit ${WEEK_LIMIT.toFixed(0)}%`}
          status={statusFor(weekPct, WEEK_LIMIT)}
        />
        <Pill
          id="slots"
          label="Slots"
          value={slotsUsed != null ? `${slotsUsed}/${SLOT_CAP}` : "—"}
          limitLabel={`max ${SLOT_CAP}`}
          status={slotStatus(slotsUsed)}
        />
      </div>
    </LayoutGroup>
  );
}

function Pill({
  id,
  label,
  value,
  limitLabel,
  status,
}: {
  id: string;
  label: string;
  value: string;
  limitLabel: string;
  status: Status;
}) {
  const tint =
    status === "tripped"
      ? "glass-tint-down"
      : status === "warn"
      ? "glass-tint-warn"
      : "glass-tint-up";
  const dot =
    status === "tripped"
      ? "bg-[var(--color-down)]"
      : status === "warn"
      ? "bg-[var(--color-warn)]"
      : "bg-[var(--color-up)]";
  const stateLabel =
    status === "tripped" ? "tripped" : status === "warn" ? "watch" : "armed";
  return (
    <motion.div
      layout
      layoutId={`breaker-${id}`}
      className={clsx(
        "glass rounded-full pl-3 pr-3.5 py-1.5 inline-flex items-center gap-2",
        tint
      )}
      transition={{ type: "spring", stiffness: 320, damping: 28 }}
    >
      <span className={clsx("w-1.5 h-1.5 rounded-full", dot, status !== "ok" && "pulse-dot")} />
      <span className="text-[10px] uppercase tracking-[0.14em] text-[var(--color-muted)] font-semibold">
        {label}
      </span>
      <span className="text-xs font-semibold tabular">{value}</span>
      <span className="text-[10px] text-[var(--color-muted)] hidden sm:inline">
        {limitLabel}
      </span>
      <span
        className={clsx(
          "text-[10px] uppercase tracking-[0.12em] font-medium",
          status === "tripped" && "text-[var(--color-down)]",
          status === "warn" && "text-[var(--color-warn)]",
          status === "ok" && "text-[var(--color-up)]"
        )}
      >
        {stateLabel}
      </span>
    </motion.div>
  );
}
