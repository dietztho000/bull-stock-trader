"use client";

import clsx from "clsx";
import { fmtMoney } from "@/lib/format";

export type AllocationSlice = {
  /** Stable slug for keying — the existing bot id, or `__new__` for the
   *  draft slice the form is currently editing. */
  id: string;
  label: string;
  /** Allocation in $. `null` = sole occupant of the account, takes ALL the
   *  remaining capital after other slices. Treated as zero in the bar
   *  (we render an "uses entire account" banner instead). */
  amount: number | null;
  variant: "existing" | "draft" | "free";
};

/** Horizontal stacked bar visualizing how an account's totalCapital is
 *  carved up across bots. Surfaces the new bot's slice in real time as the
 *  user types, plus a red overflow segment when the slices exceed the
 *  account's total — see audit F3. */
export function AllocationBar({
  totalCapital,
  slices,
}: {
  totalCapital: number | null;
  slices: AllocationSlice[];
}) {
  const numericSlices = slices.filter(
    (s) => s.amount != null && s.amount > 0
  ) as Array<AllocationSlice & { amount: number }>;
  const allocated = numericSlices.reduce((sum, s) => sum + s.amount, 0);
  const soleOccupant = slices.some((s) => s.amount == null);

  if (soleOccupant) {
    return (
      <div className="rounded-lg border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] px-3 py-2 text-[11px] text-[var(--color-muted)]">
        Bot uses the entire account&apos;s equity for sizing math — no
        allocation slice rendered.
      </div>
    );
  }

  if (totalCapital == null) {
    return (
      <div className="space-y-1.5">
        <div className="text-[10px] uppercase tracking-[0.14em] text-[var(--color-muted)] font-semibold">
          Allocations
        </div>
        <div className="rounded-lg border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] px-3 py-2 text-[11px] text-[var(--color-muted)]">
          Account has no <code className="font-mono">totalCapital</code> set —
          add one on the account row to see free vs allocated visualization.
          Total allocated across {numericSlices.length} bot
          {numericSlices.length === 1 ? "" : "s"}: {fmtMoney(allocated)}.
        </div>
      </div>
    );
  }

  const free = totalCapital - allocated;
  const overAllocated = free < 0;
  // The bar always normalizes to max(totalCapital, allocated). When over,
  // the free segment becomes a red overflow band so the eye sees by exactly
  // how much.
  const denom = Math.max(totalCapital, allocated, 1);

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.14em] text-[var(--color-muted)] font-semibold">
        <span>Allocations</span>
        <span
          className={clsx(
            "tabular text-[11px] normal-case font-medium",
            overAllocated ? "text-[var(--color-down)]" : "text-[var(--color-muted)]"
          )}
        >
          {fmtMoney(allocated)} / {fmtMoney(totalCapital)}
          {overAllocated && (
            <> · over by {fmtMoney(-free)}</>
          )}
        </span>
      </div>
      <div
        className="flex h-3 rounded-full overflow-hidden bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.06)]"
        role="img"
        aria-label={`Allocation bar: ${fmtMoney(allocated)} of ${fmtMoney(totalCapital)} allocated${
          overAllocated ? `, over by ${fmtMoney(-free)}` : `, ${fmtMoney(free)} free`
        }`}
      >
        {numericSlices.map((s) => {
          const widthPct = (s.amount / denom) * 100;
          const tone =
            s.variant === "draft"
              ? "bg-[var(--color-accent)]"
              : "bg-[rgba(255,255,255,0.18)]";
          return (
            <div
              key={s.id}
              className={clsx("h-full transition-[width] duration-200", tone)}
              style={{ width: `${widthPct}%` }}
              title={`${s.label}: ${fmtMoney(s.amount)}`}
            />
          );
        })}
        {free > 0 && (
          <div
            className="h-full bg-transparent"
            style={{ width: `${(free / denom) * 100}%` }}
            title={`Free: ${fmtMoney(free)}`}
          />
        )}
        {overAllocated && (
          <div
            className="h-full bg-[var(--color-down)]"
            style={{ width: `${(-free / denom) * 100}%` }}
            title={`Over by ${fmtMoney(-free)}`}
          />
        )}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-[var(--color-muted)]">
        {numericSlices.map((s) => (
          <span key={s.id} className="flex items-center gap-1">
            <span
              className={clsx(
                "inline-block h-2 w-2 rounded-sm",
                s.variant === "draft"
                  ? "bg-[var(--color-accent)]"
                  : "bg-[rgba(255,255,255,0.18)]"
              )}
            />
            {s.label}
            <span className="tabular text-[var(--color-text)]">
              {fmtMoney(s.amount)}
            </span>
          </span>
        ))}
        {free > 0 && (
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-sm border border-[rgba(255,255,255,0.2)]" />
            Free
            <span className="tabular text-[var(--color-text)]">
              {fmtMoney(free)}
            </span>
          </span>
        )}
      </div>
    </div>
  );
}
