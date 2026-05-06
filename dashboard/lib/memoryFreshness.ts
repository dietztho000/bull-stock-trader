import fs from "node:fs/promises";
import path from "node:path";
import { resolveMemoryFile, BOT_ROOT, type MemoryCtx } from "./memoryPath";
import { loadBenchmark } from "./parsers/benchmark";
import { todayInCT, isTradingDayCT } from "./time";

export type SyncStatus = "ok" | "error" | "running" | "unknown";

/** Per-bot memory files we treat as "data writes". The freshest mtime among
 *  them drives `dataWriteMs`. BENCHMARK alone was misleading mid-morning —
 *  it's only rewritten by daily-summary, so a TRADE-LOG/RUN-LOG write at
 *  market-open didn't count and the pill showed yesterday's mtime. */
const PER_BOT_DATA_FILES = [
  "BENCHMARK.md",
  "TRADE-LOG.md",
  "RESEARCH-LOG.md",
  "RUN-LOG.jsonl",
  "SECTOR-LEDGER.md",
] as const;

export type MemoryFreshness = {
  /** Newest mtime among per-bot data files (BENCHMARK, TRADE-LOG, RESEARCH-
   *  LOG, RUN-LOG, SECTOR-LEDGER) — when any cloud routine last wrote data. */
  dataWriteMs: number | null;
  /** finishedAt of the last cron-sync.sh run — when the local pull last
   *  completed. Distinct from `dataWriteMs`: pulls can succeed every 15 min
   *  even if no routine wrote anything to disk. */
  lastSyncMs: number | null;
  lastSyncStatus: SyncStatus;
  lastSyncMessage: string | null;
  lastSyncTrigger: "launchd" | "manual" | null;
  latestRowDate: string | null;
  todayCT: string;
  isTradingDay: boolean;
  status: "fresh" | "warn" | "stale";
};

type CronStatusFile = {
  startedAt?: string;
  finishedAt?: string | null;
  exitCode?: number | null;
  trigger?: string;
  message?: string;
};

/** Hard cap for how old `lastSyncMs` is allowed to be before we force the
 *  pill into stale state. The launchd job ticks every 15 min, so anything
 *  past 30 min means it has missed at least one cycle. */
const SYNC_STALE_MS = 30 * 60 * 1000;

export async function loadMemoryFreshness(ctx: MemoryCtx): Promise<MemoryFreshness> {
  const todayCT = todayInCT();
  const tradingDay = isTradingDayCT(todayCT);

  const mtimes = await Promise.all(
    PER_BOT_DATA_FILES.map(async (file) => {
      try {
        const stat = await fs.stat(resolveMemoryFile(file, ctx));
        return stat.mtimeMs;
      } catch {
        return null;
      }
    })
  );
  const validMtimes = mtimes.filter((m): m is number => m != null);
  const dataWriteMs: number | null =
    validMtimes.length > 0 ? Math.max(...validMtimes) : null;

  const sync = await loadCronSyncStatus();

  let latestRowDate: string | null = null;
  try {
    const bench = await loadBenchmark(ctx);
    latestRowDate = bench.rows.at(-1)?.date ?? null;
  } catch {
    latestRowDate = null;
  }

  const dataAgeHours =
    dataWriteMs != null ? (Date.now() - dataWriteMs) / (1000 * 60 * 60) : Infinity;
  const rowIsToday = latestRowDate === todayCT;
  const rowIsYesterday =
    latestRowDate != null && rowIsBeforeOrEqual(latestRowDate, todayCT, 1);

  let status: "fresh" | "warn" | "stale";
  if (!tradingDay) {
    status = dataAgeHours < 24 ? "fresh" : "warn";
  } else if (rowIsToday && dataAgeHours < 2) {
    status = "fresh";
  } else if ((rowIsToday && dataAgeHours < 6) || rowIsYesterday) {
    status = "warn";
  } else {
    status = "stale";
  }

  // The pull job is the dashboard's only data path — if it has stopped
  // ticking or errored, surface that even when BENCHMARK.md happens to be
  // recent (e.g. the user manually edited it).
  const syncIsBroken =
    sync.lastSyncStatus === "error" ||
    (sync.lastSyncMs != null && Date.now() - sync.lastSyncMs > SYNC_STALE_MS);
  if (syncIsBroken && status === "fresh") status = "warn";
  if (syncIsBroken && sync.lastSyncStatus === "error") status = "stale";

  return {
    dataWriteMs,
    lastSyncMs: sync.lastSyncMs,
    lastSyncStatus: sync.lastSyncStatus,
    lastSyncMessage: sync.lastSyncMessage,
    lastSyncTrigger: sync.lastSyncTrigger,
    latestRowDate,
    todayCT,
    isTradingDay: tradingDay,
    status,
  };
}

type CronSyncStatusResult = {
  lastSyncMs: number | null;
  lastSyncStatus: SyncStatus;
  lastSyncMessage: string | null;
  lastSyncTrigger: "launchd" | "manual" | null;
};

async function loadCronSyncStatus(): Promise<CronSyncStatusResult> {
  const filePath = path.join(BOT_ROOT, ".cron-sync-status.json");
  let raw: string;
  try {
    raw = await fs.readFile(filePath, "utf8");
  } catch {
    return {
      lastSyncMs: null,
      lastSyncStatus: "unknown",
      lastSyncMessage: null,
      lastSyncTrigger: null,
    };
  }

  let parsed: CronStatusFile;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return {
      lastSyncMs: null,
      lastSyncStatus: "unknown",
      lastSyncMessage: "status file corrupt",
      lastSyncTrigger: null,
    };
  }

  const trigger =
    parsed.trigger === "launchd" || parsed.trigger === "manual"
      ? parsed.trigger
      : null;
  const message = typeof parsed.message === "string" ? parsed.message : null;

  // No finishedAt → script wrote the in-flight marker but hasn't returned.
  // This is normal for the few seconds a manual sync is mid-flight.
  if (!parsed.finishedAt) {
    const startedMs = parsed.startedAt ? Date.parse(parsed.startedAt) : NaN;
    return {
      lastSyncMs: Number.isFinite(startedMs) ? startedMs : null,
      lastSyncStatus: "running",
      lastSyncMessage: message,
      lastSyncTrigger: trigger,
    };
  }

  const finishedMs = Date.parse(parsed.finishedAt);
  const exit = parsed.exitCode;
  const status: SyncStatus =
    typeof exit !== "number" ? "unknown" : exit === 0 ? "ok" : "error";

  return {
    lastSyncMs: Number.isFinite(finishedMs) ? finishedMs : null,
    lastSyncStatus: status,
    lastSyncMessage: message,
    lastSyncTrigger: trigger,
  };
}

function rowIsBeforeOrEqual(rowDate: string, today: string, daysBack: number): boolean {
  const t = new Date(`${today}T00:00:00Z`);
  const cutoff = new Date(t.getTime() - daysBack * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
  return rowDate >= cutoff && rowDate < today;
}
