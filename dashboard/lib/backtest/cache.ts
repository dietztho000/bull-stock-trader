// Structured snapshot of the most recent backtest run, persisted alongside
// BACKTEST-RESULTS.md (the human-readable copy). The Analytics page reads
// this JSON instead of re-running the engine on every page render.

import path from "node:path";
import fs from "node:fs/promises";
import { MEMORY_DIR } from "@/lib/memoryPath";
import type { BacktestResult, BacktestSummary } from "./types";

const FILE_NAME = "BACKTEST-RESULTS.json";

export type BacktestSnapshot = {
  summary: BacktestSummary;
  results: BacktestResult[];
};

export async function writeBacktestSnapshot(
  summary: BacktestSummary,
  results: BacktestResult[]
): Promise<void> {
  const filePath = path.join(MEMORY_DIR, FILE_NAME);
  const snapshot: BacktestSnapshot = { summary, results };
  await fs.writeFile(filePath, JSON.stringify(snapshot, null, 2), "utf8");
}

export async function readBacktestSnapshot(): Promise<BacktestSnapshot | null> {
  const filePath = path.join(MEMORY_DIR, FILE_NAME);
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return JSON.parse(raw) as BacktestSnapshot;
  } catch {
    return null;
  }
}
