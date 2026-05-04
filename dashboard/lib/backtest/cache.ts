// Structured snapshot of the most recent backtest run, persisted alongside
// BACKTEST-RESULTS.md (the human-readable copy). The Analytics page reads
// this JSON instead of re-running the engine on every page render.
//
// Audit F4 — every run also writes a dated copy under
// `memory/<bot>/<strategy>/backtests/<id>.json`, so the user can compare
// runs side-by-side instead of seeing each run overwrite the last.

import path from "node:path";
import fs from "node:fs/promises";
import {
  botMemoryDir,
  DEFAULT_STRATEGY,
  resolveMemoryFile,
  type MemoryCtx,
} from "@/lib/memoryPath";
import type { BacktestResult, BacktestSummary } from "./types";

const FILE_NAME = "BACKTEST-RESULTS.json";
const SNAPSHOTS_DIR = "backtests";

export type BacktestSnapshot = {
  summary: BacktestSummary;
  results: BacktestResult[];
};

/** Stable id for a snapshot file: `${runDate}-${timestamp}` so multiple
 *  runs in one CT calendar day stay distinguishable, and lexicographic
 *  sort = chronological order. */
export type BacktestSnapshotMeta = {
  id: string;
  runDate: string;
  savedAt: number;
  tradeCount: number;
  totalActualPnl: number;
  totalSimPnl: number;
  pnlDelta: number;
  ladderFireRate: number;
  strategySourceBot: string | null;
  strategyParamsUsed: Record<string, number> | null;
};

function snapshotsDir(ctx: MemoryCtx): string {
  return path.join(botMemoryDir(ctx.bot, ctx.strategy ?? DEFAULT_STRATEGY), SNAPSHOTS_DIR);
}

function snapshotIdFor(summary: BacktestSummary, savedAt: number): string {
  // Suffix the run date with the save-time epoch so two runs the same day
  // don't collide. Both halves are filename-safe (digits + hyphens).
  return `${summary.runDate}-${savedAt}`;
}

export async function writeBacktestSnapshot(
  summary: BacktestSummary,
  results: BacktestResult[],
  ctx: MemoryCtx
): Promise<{ id: string }> {
  const filePath = resolveMemoryFile(FILE_NAME, ctx);
  const snapshot: BacktestSnapshot = { summary, results };
  const json = JSON.stringify(snapshot, null, 2);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, json, "utf8");
  // Also append a dated copy. The latest snapshot pointer (BACKTEST-RESULTS.json)
  // stays as-is for back-compat with existing readers.
  const savedAt = Date.now();
  const id = snapshotIdFor(summary, savedAt);
  const dir = snapshotsDir(ctx);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, `${id}.json`), json, "utf8");
  return { id };
}

export async function readBacktestSnapshot(ctx: MemoryCtx): Promise<BacktestSnapshot | null> {
  const filePath = resolveMemoryFile(FILE_NAME, ctx);
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return JSON.parse(raw) as BacktestSnapshot;
  } catch {
    return null;
  }
}

/** List all retained snapshots for a bot/strategy in newest-first order.
 *  Reads each file's metadata-only fields to keep the list response small. */
export async function listBacktestSnapshots(
  ctx: MemoryCtx
): Promise<BacktestSnapshotMeta[]> {
  const dir = snapshotsDir(ctx);
  let names: string[];
  try {
    names = await fs.readdir(dir);
  } catch {
    return [];
  }
  const ids = names
    .filter((n) => n.endsWith(".json"))
    .map((n) => n.slice(0, -".json".length));
  const metas = await Promise.all(
    ids.map(async (id) => {
      const snap = await readBacktestSnapshotById(ctx, id);
      if (!snap) return null;
      // Parse savedAt out of the id suffix; fall back to file mtime if missing.
      const dashIdx = id.lastIndexOf("-");
      const tsRaw = dashIdx >= 0 ? Number(id.slice(dashIdx + 1)) : NaN;
      let savedAt = Number.isFinite(tsRaw) ? tsRaw : 0;
      if (!savedAt) {
        try {
          const stat = await fs.stat(path.join(dir, `${id}.json`));
          savedAt = stat.mtimeMs;
        } catch {
          savedAt = 0;
        }
      }
      const meta: BacktestSnapshotMeta = {
        id,
        runDate: snap.summary.runDate,
        savedAt,
        tradeCount: snap.summary.tradeCount,
        totalActualPnl: snap.summary.totalActualPnl,
        totalSimPnl: snap.summary.totalSimPnl,
        pnlDelta: snap.summary.pnlDelta,
        ladderFireRate: snap.summary.ladderFireRate,
        strategySourceBot: snap.summary.strategySourceBot ?? null,
        strategyParamsUsed: snap.summary.strategyParamsUsed ?? null,
      };
      return meta;
    })
  );
  return metas
    .filter((m): m is BacktestSnapshotMeta => m !== null)
    .sort((a, b) => b.savedAt - a.savedAt);
}

export async function readBacktestSnapshotById(
  ctx: MemoryCtx,
  id: string
): Promise<BacktestSnapshot | null> {
  // Refuse anything that could traverse out of the snapshots dir. Snapshot
  // ids are all `<YYYY-MM-DD>-<digits>` so this is conservative but safe.
  if (!/^[A-Za-z0-9._-]+$/.test(id)) return null;
  const filePath = path.join(snapshotsDir(ctx), `${id}.json`);
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return JSON.parse(raw) as BacktestSnapshot;
  } catch {
    return null;
  }
}
