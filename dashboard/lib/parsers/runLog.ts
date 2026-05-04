import { readMemory, type MemoryCtx } from "../memoryPath";
import { dateInCT } from "../time";

export type RunStatus = "ok" | "error" | "unknown";

export type RunRecord = {
  routine: string;
  startTs: string | null;
  endTs: string | null;
  status: RunStatus;
  durationMs: number | null;
  gitSha: string | null;
};

type RawEntry = {
  ts?: string;
  routine?: string;
  action?: string;
  status?: string;
  git_sha?: string;
};

const SEED_ROUTINE = "_seed";

function normalizeStatus(raw: string | undefined): RunStatus {
  if (raw === "ok") return "ok";
  if (raw === "error" || raw === "fail" || raw === "failed") return "error";
  return "unknown";
}

/**
 * Pairs every `start` record with the next matching `end` record from the
 * same routine. An unpaired `start` becomes a run with no end (still in
 * flight, or crashed before writing the end). An unpaired `end` is dropped —
 * old logs may be truncated above their `start`.
 */
export async function loadRunLog(ctx: MemoryCtx): Promise<RunRecord[]> {
  const raw = await readMemory("RUN-LOG.jsonl", ctx);
  if (!raw.trim()) return [];

  const entries: RawEntry[] = [];
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      entries.push(JSON.parse(trimmed) as RawEntry);
    } catch {
      // ignore malformed lines
    }
  }

  const pendingStarts = new Map<string, RawEntry>();
  const out: RunRecord[] = [];

  for (const entry of entries) {
    if (!entry.routine || entry.routine === SEED_ROUTINE) continue;
    if (entry.action === "start") {
      const existing = pendingStarts.get(entry.routine);
      if (existing) {
        // Previous start without a matching end — emit it as in-flight.
        out.push({
          routine: existing.routine!,
          startTs: existing.ts ?? null,
          endTs: null,
          status: normalizeStatus(existing.status),
          durationMs: null,
          gitSha: existing.git_sha ?? null,
        });
      }
      pendingStarts.set(entry.routine, entry);
    } else if (entry.action === "end") {
      const start = pendingStarts.get(entry.routine);
      pendingStarts.delete(entry.routine);
      const startMs = start?.ts ? Date.parse(start.ts) : NaN;
      const endMs = entry.ts ? Date.parse(entry.ts) : NaN;
      out.push({
        routine: entry.routine,
        startTs: start?.ts ?? null,
        endTs: entry.ts ?? null,
        status: normalizeStatus(entry.status ?? start?.status),
        durationMs:
          Number.isFinite(startMs) && Number.isFinite(endMs)
            ? Math.max(0, endMs - startMs)
            : null,
        gitSha: entry.git_sha ?? start?.git_sha ?? null,
      });
    }
  }

  // Flush any remaining unpaired starts as in-flight runs.
  for (const start of pendingStarts.values()) {
    out.push({
      routine: start.routine!,
      startTs: start.ts ?? null,
      endTs: null,
      status: normalizeStatus(start.status),
      durationMs: null,
      gitSha: start.git_sha ?? null,
    });
  }

  out.sort((a, b) => {
    const aTs = a.endTs ?? a.startTs ?? "";
    const bTs = b.endTs ?? b.startTs ?? "";
    return bTs.localeCompare(aTs);
  });

  return out;
}

export const DAILY_ROUTINES = [
  "auth-canary",
  "pre-market",
  "market-open",
  "mid-morning",
  "late-morning",
  "midday",
  "stops",
  "afternoon",
  "daily-summary",
] as const;

export const FRIDAY_ROUTINE = "weekly-review";

export type RoutineDayStatus = {
  routine: string;
  expected: boolean;
  lastRun: RunRecord | null;
};

/**
 * Joins each expected daily routine against today's run records (in CT) so
 * the UI can render a "did this fire today?" checklist. weekly-review is
 * appended only on Fridays.
 */
export function summarizeToday(
  runs: RunRecord[],
  todayCT: string,
  isFriday: boolean
): RoutineDayStatus[] {
  const todaysRuns = new Map<string, RunRecord>();
  for (const r of runs) {
    const stamp = r.endTs ?? r.startTs;
    if (!stamp) continue;
    if (dateInCT(stamp) !== todayCT) continue;
    if (!todaysRuns.has(r.routine)) {
      todaysRuns.set(r.routine, r);
    }
  }

  const expected: string[] = [...DAILY_ROUTINES];
  if (isFriday) expected.push(FRIDAY_ROUTINE);

  return expected.map((routine) => ({
    routine,
    expected: true,
    lastRun: todaysRuns.get(routine) ?? null,
  }));
}

/** One bot's column in the cross-bot routine matrix (audit F6). For each
 *  expected routine, surfaces today's latest fire and the count of error
 *  fires in the last `lookbackDays` trading days so the UI can flag
 *  "midday failed for momentum-10k 3 days running" patterns. */
export type RoutineMatrixCell = {
  routine: string;
  /** Latest fire today (CT), if any — drives the primary status badge. */
  todayRun: RunRecord | null;
  /** Distinct CT calendar dates within the lookback window where this
   *  routine ended in `error` status. Sorted oldest → newest. */
  errorDates: string[];
};

export type RoutineMatrixColumn = {
  botId: string;
  cells: RoutineMatrixCell[];
};

export function buildRoutineMatrix(
  perBotRuns: Array<{ botId: string; runs: RunRecord[] }>,
  todayCT: string,
  isFriday: boolean,
  lookbackDays = 5
): {
  routines: string[];
  columns: RoutineMatrixColumn[];
} {
  const routines: string[] = [...DAILY_ROUTINES];
  if (isFriday) routines.push(FRIDAY_ROUTINE);

  // Build the rolling lookback window of CT dates so a Monday morning view
  // doesn't ignore Friday's failures by counting only "the last 5 calendar
  // days" — we just count distinct error dates rather than slot per day.
  const cutoffMs = Date.now() - lookbackDays * 86_400_000;

  const columns: RoutineMatrixColumn[] = perBotRuns.map(({ botId, runs }) => {
    const todaysByRoutine = new Map<string, RunRecord>();
    const errorsByRoutine = new Map<string, Set<string>>();

    for (const r of runs) {
      const stamp = r.endTs ?? r.startTs;
      if (!stamp) continue;
      const dateCT = dateInCT(stamp);
      if (dateCT === todayCT && !todaysByRoutine.has(r.routine)) {
        todaysByRoutine.set(r.routine, r);
      }
      const ms = Date.parse(stamp);
      if (Number.isFinite(ms) && ms >= cutoffMs && r.status === "error") {
        const set = errorsByRoutine.get(r.routine) ?? new Set<string>();
        set.add(dateCT);
        errorsByRoutine.set(r.routine, set);
      }
    }

    const cells: RoutineMatrixCell[] = routines.map((routine) => ({
      routine,
      todayRun: todaysByRoutine.get(routine) ?? null,
      errorDates: Array.from(errorsByRoutine.get(routine) ?? []).sort(),
    }));

    return { botId, cells };
  });

  return { routines, columns };
}
