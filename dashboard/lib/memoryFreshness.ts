import path from "node:path";
import fs from "node:fs/promises";
import { MEMORY_DIR } from "./memoryPath";
import { loadBenchmark } from "./parsers/benchmark";
import { todayInCT, isTradingDayCT } from "./time";

export type MemoryFreshness = {
  syncMtimeMs: number | null;
  latestRowDate: string | null;
  todayCT: string;
  isTradingDay: boolean;
  status: "fresh" | "warn" | "stale";
};

export async function loadMemoryFreshness(): Promise<MemoryFreshness> {
  const todayCT = todayInCT();
  const tradingDay = isTradingDayCT(todayCT);

  let syncMtimeMs: number | null = null;
  try {
    const stat = await fs.stat(path.join(MEMORY_DIR, "BENCHMARK.md"));
    syncMtimeMs = stat.mtimeMs;
  } catch {
    syncMtimeMs = null;
  }

  let latestRowDate: string | null = null;
  try {
    const bench = await loadBenchmark();
    latestRowDate = bench.rows.at(-1)?.date ?? null;
  } catch {
    latestRowDate = null;
  }

  const ageHours =
    syncMtimeMs != null ? (Date.now() - syncMtimeMs) / (1000 * 60 * 60) : Infinity;
  const rowIsToday = latestRowDate === todayCT;
  const rowIsYesterday =
    latestRowDate != null && rowIsBeforeOrEqual(latestRowDate, todayCT, 1);

  let status: "fresh" | "warn" | "stale";
  if (!tradingDay) {
    status = ageHours < 24 ? "fresh" : "warn";
  } else if (rowIsToday && ageHours < 2) {
    status = "fresh";
  } else if ((rowIsToday && ageHours < 6) || rowIsYesterday) {
    status = "warn";
  } else {
    status = "stale";
  }

  return { syncMtimeMs, latestRowDate, todayCT, isTradingDay: tradingDay, status };
}

function rowIsBeforeOrEqual(rowDate: string, today: string, daysBack: number): boolean {
  const t = new Date(`${today}T00:00:00Z`);
  const cutoff = new Date(t.getTime() - daysBack * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
  return rowDate >= cutoff && rowDate < today;
}
