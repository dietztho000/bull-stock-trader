"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { Card, Badge } from "@/components/ui/Card";
import type {
  RoutineMatrixColumn,
  RunRecord,
} from "@/lib/parsers/runLog";

/** Audit F3 — cross-bot routine matrix. The aggregator runs server-side
 *  in the journal page; this component gives the user filtering, sticky
 *  navigation, and a refresh button without forcing a full page reload. */
export function CrossBotRoutineGrid({
  todayCT,
  routines,
  columns,
  botNames,
}: {
  todayCT: string;
  routines: string[];
  columns: RoutineMatrixColumn[];
  botNames: Record<string, string>;
}) {
  const router = useRouter();
  const [isRefreshing, startTransition] = useTransition();
  const [errorsOnly, setErrorsOnly] = useState(false);

  // Per-routine totals: count of (bot, error-day) pairs in the lookback
  // window. Surfaces "midday has 7 error-days across 3 bots" at a glance
  // so the user doesn't have to scan every row's cells.
  const summaryByRoutine = useMemo(() => {
    const map = new Map<string, { errorDays: number; affectedBots: number }>();
    for (const routine of routines) {
      let errorDays = 0;
      let affectedBots = 0;
      for (const col of columns) {
        const cell = col.cells.find((c) => c.routine === routine);
        if (cell && cell.errorDates.length > 0) {
          errorDays += cell.errorDates.length;
          affectedBots += 1;
        }
      }
      map.set(routine, { errorDays, affectedBots });
    }
    return map;
  }, [routines, columns]);

  const visibleRoutines = useMemo(() => {
    if (!errorsOnly) return routines;
    return routines.filter((r) => {
      const sum = summaryByRoutine.get(r);
      if (sum && sum.errorDays > 0) return true;
      // Also keep routines that errored or missed *today* (the most urgent
      // signal even if the lookback window is clean — yesterday-was-fine
      // doesn't mean today is fine).
      return columns.some((col) => {
        const cell = col.cells.find((c) => c.routine === r);
        const today = cell?.todayRun ?? null;
        return today === null || today.status === "error";
      });
    });
  }, [errorsOnly, routines, columns, summaryByRoutine]);

  const totalErrorDays = useMemo(
    () =>
      Array.from(summaryByRoutine.values()).reduce(
        (sum, s) => sum + s.errorDays,
        0
      ),
    [summaryByRoutine]
  );

  return (
    <Card
      title={`Cross-bot routines — ${todayCT}`}
      subtitle={`${columns.length} bots × ${routines.length} routines · ${totalErrorDays} error-days in last 5 · color = today's fire status · • = recent error days`}
      right={
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1.5 text-[11px] cursor-pointer select-none">
            <input
              type="checkbox"
              checked={errorsOnly}
              onChange={(e) => setErrorsOnly(e.target.checked)}
              className="accent-[var(--color-down)]"
            />
            <span>Errors only</span>
          </label>
          <button
            type="button"
            onClick={() => startTransition(() => router.refresh())}
            disabled={isRefreshing}
            className="glass rounded-full px-2.5 py-1 text-[11px] font-semibold disabled:opacity-50"
            title="Re-fetch every bot's RUN-LOG.jsonl"
          >
            {isRefreshing ? "Refreshing…" : "Refresh"}
          </button>
        </div>
      }
    >
      {visibleRoutines.length === 0 ? (
        <div className="text-xs text-[var(--color-muted)] py-3">
          🟢 No errors in the last 5 days. Toggle off &ldquo;Errors only&rdquo; to see
          all routines.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs tabular border-separate border-spacing-y-1">
            <thead>
              <tr className="text-left text-[10px] uppercase tracking-[0.14em] text-[var(--color-muted)]">
                <th className="sticky left-0 z-10 bg-[var(--color-bg)] py-1.5 pr-3 min-w-[160px]">
                  Routine
                </th>
                {columns.map((c) => (
                  <th
                    key={c.botId}
                    className="py-1.5 px-2 text-center"
                    title={c.botId}
                  >
                    <div className="font-semibold text-[var(--color-text)] truncate max-w-[120px] mx-auto">
                      {botNames[c.botId] ?? c.botId}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visibleRoutines.map((routine) => {
                const sum = summaryByRoutine.get(routine);
                return (
                  <tr key={routine}>
                    <td className="sticky left-0 z-10 bg-[var(--color-bg)] py-1.5 pr-3 align-top">
                      <div className="font-mono text-[11px] text-[var(--color-muted)]">
                        {routine}
                      </div>
                      {sum && sum.errorDays > 0 && (
                        <div className="text-[10px] text-[var(--color-down)] font-semibold mt-0.5">
                          {sum.errorDays} error day
                          {sum.errorDays === 1 ? "" : "s"} · {sum.affectedBots}{" "}
                          bot{sum.affectedBots === 1 ? "" : "s"}
                        </div>
                      )}
                    </td>
                    {columns.map((col) => {
                      const cell = col.cells.find((c) => c.routine === routine);
                      const tone = statusTone(cell?.todayRun ?? null);
                      const label = statusLabel(cell?.todayRun ?? null);
                      const errorCount = cell?.errorDates.length ?? 0;
                      return (
                        <td key={col.botId} className="px-2 text-center align-top">
                          <div
                            title={`${routine} @ ${botNames[col.botId] ?? col.botId} — today: ${label}${
                              errorCount
                                ? ` · ${errorCount} error day${errorCount === 1 ? "" : "s"} in last 5 (${cell!.errorDates.join(", ")})`
                                : ""
                            }`}
                          >
                            <Badge tone={tone}>{label}</Badge>
                            {errorCount > 0 && (
                              <div
                                className={clsx(
                                  "mt-0.5 text-[9px] font-mono",
                                  "text-[var(--color-down)]"
                                )}
                                aria-label={`${errorCount} recent error days`}
                              >
                                {"●".repeat(Math.min(errorCount, 5))}
                              </div>
                            )}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

function statusTone(run: RunRecord | null): "up" | "down" | "warn" | "neutral" {
  if (!run) return "neutral";
  if (run.status === "error") return "down";
  if (run.endTs == null) return "warn";
  return "up";
}

function statusLabel(run: RunRecord | null): string {
  if (!run) return "missed";
  if (run.status === "error") return "error";
  if (run.endTs == null) return "in flight";
  return "ok";
}
