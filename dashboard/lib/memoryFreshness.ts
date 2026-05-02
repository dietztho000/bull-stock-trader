import path from "node:path";
import fs from "node:fs/promises";
import { MEMORY_DIR } from "./memoryPath";
import { loadBenchmark } from "./parsers/benchmark";

export type MemoryFreshness = {
  syncMtimeMs: number | null;
  latestRowDate: string | null;
  todayET: string;
  isTradingDay: boolean;
  status: "fresh" | "warn" | "stale";
};

export function todayInET(now = new Date()): string {
  return now.toLocaleDateString("en-CA", { timeZone: "America/New_York" });
}

export function isTradingDayET(dateStr: string): boolean {
  const d = new Date(`${dateStr}T12:00:00-05:00`);
  const dow = d.getUTCDay();
  return dow >= 1 && dow <= 5;
}

export async function loadMemoryFreshness(): Promise<MemoryFreshness> {
  const todayET = todayInET();
  const tradingDay = isTradingDayET(todayET);

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
  const rowIsToday = latestRowDate === todayET;
  const rowIsYesterday =
    latestRowDate != null && rowIsBeforeOrEqual(latestRowDate, todayET, 1);

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

  return { syncMtimeMs, latestRowDate, todayET, isTradingDay: tradingDay, status };
}

function rowIsBeforeOrEqual(rowDate: string, today: string, daysBack: number): boolean {
  const t = new Date(`${today}T00:00:00Z`);
  const cutoff = new Date(t.getTime() - daysBack * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
  return rowDate >= cutoff && rowDate < today;
}
