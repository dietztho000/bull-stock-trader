"use client";

import { useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/Card";
import { fmtRelativeTime } from "@/lib/format";
import { fmtClockCT } from "@/lib/time";
import { Z } from "@/lib/zIndex";

type RoutineStatus = {
  routine: string;
  startTs: string | null;
  endTs: string | null;
  status: "ok" | "error" | "unknown" | "missing";
};

export function RoutineHealthPopover({
  latestTs,
  routines,
  todayCT,
}: {
  /** Latest end/start ts across today's runs, ms epoch. Null when nothing
   *  fired today — the trigger reads "Routines: never". */
  latestTs: number | null;
  /** One row per expected routine for today. `status: "missing"` means the
   *  routine is on the schedule but never wrote an `end` row. */
  routines: RoutineStatus[];
  todayCT: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  // Click-outside to close. Audit B drill-down — a popover that traps focus
  // would be overkill for a read-only status panel; click-outside is enough.
  useEffect(() => {
    if (!open) return;
    function onPointer(e: MouseEvent) {
      if (!ref.current) return;
      if (e.target instanceof Node && ref.current.contains(e.target)) return;
      setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const fired = routines.filter((r) => r.status === "ok").length;
  const total = routines.length;
  const missing = routines.filter((r) => r.status === "missing").length;
  const errored = routines.filter((r) => r.status === "error").length;

  // Trigger pill tone mirrors the original badge logic.
  let tone: "up" | "down" | "neutral" | "warn" = "neutral";
  let label: string;
  if (latestTs == null) {
    tone = "warn";
    label = "Routines: never";
  } else {
    const diffH = (Date.now() - latestTs) / 3_600_000;
    if (diffH > 36 || errored > 0 || missing > total / 2) tone = "down";
    else if (diffH > 12 || missing > 0) tone = "neutral";
    else tone = "up";
    label = `Routines ${fired}/${total} · ${fmtRelativeTime(latestTs)}`;
  }

  return (
    <div ref={ref} className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="dialog"
        className="cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] rounded-full"
        title={
          latestTs == null
            ? `No routines have fired today (${todayCT})`
            : `Last entry at ${fmtClockCT(new Date(latestTs))} CT — click for breakdown`
        }
      >
        <Badge tone={tone}>{label}</Badge>
      </button>
      {open && (
        <div
          role="dialog"
          aria-label="Routine health for today"
          style={{ zIndex: Z.POPOVER }}
          className="absolute right-0 mt-2 w-72 frost rounded-xl p-3 shadow-lg"
        >
          <div className="text-[10px] uppercase tracking-[0.16em] text-[var(--color-muted)] font-semibold mb-2">
            Today {todayCT}
          </div>
          <ul className="space-y-1.5 text-xs">
            {routines.map((r) => (
              <li
                key={r.routine}
                className="flex items-center justify-between gap-2"
              >
                <span className="flex items-center gap-2 min-w-0">
                  <StatusDot status={r.status} />
                  <span className="truncate">{r.routine}</span>
                </span>
                <span className="tabular text-[var(--color-muted)] text-[11px]">
                  {r.endTs
                    ? fmtClockCT(new Date(r.endTs))
                    : r.startTs
                    ? `started ${fmtClockCT(new Date(r.startTs))}`
                    : "—"}
                </span>
              </li>
            ))}
          </ul>
          {missing > 0 && (
            <div className="mt-3 pt-2 border-t border-[rgba(255,255,255,0.08)] text-[11px] text-[var(--color-muted)]">
              <strong className="text-[var(--color-warn)]">{missing} missing.</strong>{" "}
              Check the cloud Routines UI to rerun them, or wait for the next
              scheduled fire.
            </div>
          )}
          {errored > 0 && (
            <div className="mt-2 text-[11px] text-[var(--color-down)]">
              <strong>{errored} errored.</strong> Tail the routine's logs in the
              cloud Routines UI for the stack trace.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function StatusDot({ status }: { status: RoutineStatus["status"] }) {
  const cls =
    status === "ok"
      ? "bg-[var(--color-up)]"
      : status === "error"
      ? "bg-[var(--color-down)]"
      : status === "missing"
      ? "bg-[var(--color-muted)]"
      : "bg-[var(--color-warn)]";
  return (
    <span
      aria-hidden="true"
      className={`inline-block w-2 h-2 rounded-full ${cls} shrink-0`}
    />
  );
}
