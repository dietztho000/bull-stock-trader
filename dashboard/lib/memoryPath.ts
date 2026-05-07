import path from "node:path";
import fs from "node:fs/promises";
import type { BotId } from "./alpacaMode";

const ROOT = path.resolve(process.cwd(), "..");
export const MEMORY_ROOT = path.join(ROOT, "memory");
export const SCRIPTS_DIR = path.join(ROOT, "scripts");
export const BOT_ROOT = ROOT;
export const SHARED_MEMORY_DIR = path.join(MEMORY_ROOT, "shared");
export const DEFAULT_STRATEGY = "default";

/** Audit A1 — bot id → on-disk memory directory mapping.
 *
 *  The seed-from-env migration creates `legacy-live` / `legacy-paper`
 *  bots whose memory still lives at `memory/live/` and `memory/paper/`
 *  (because the cron-side bot writes there based on `BOT_MODE`, regardless
 *  of dashboard naming). The `memoryAlias` field on each Bot expresses
 *  this relationship; this module-global cache lets every memory-resolving
 *  call honor it without threading the alias through every MemoryCtx.
 *
 *  Populated by `loadSettings` on every read, so the cache is always
 *  fresh after the first settings access and there's no stale-data
 *  window in practice. Aliases that match the bot id (or are unset) are
 *  omitted — the cache only carries actual rename mappings. */
declare global {
  // eslint-disable-next-line no-var
  var __memoryAliasMap: Map<string, string> | undefined;
}
function aliasMap(): Map<string, string> {
  if (!globalThis.__memoryAliasMap) globalThis.__memoryAliasMap = new Map();
  return globalThis.__memoryAliasMap;
}
export function setMemoryAliases(entries: Iterable<[string, string]>): void {
  const next = new Map<string, string>();
  for (const [k, v] of entries) {
    if (k && v && k !== v) next.set(k, v);
  }
  globalThis.__memoryAliasMap = next;
}
function resolveMemoryDir(bot: BotId): string {
  return aliasMap().get(bot) ?? bot;
}

export function botMemoryDir(bot: BotId, strategy: string = DEFAULT_STRATEGY): string {
  return path.join(MEMORY_ROOT, resolveMemoryDir(bot), strategy);
}

export function sharedMemoryDir(): string {
  return SHARED_MEMORY_DIR;
}

export type MemoryCtx = { bot: BotId; strategy?: string };

type FileScope =
  | { scope: "shared" }
  | { scope: "per-bot" }
  | { scope: "per-bot-runtime"; gitignored: true };

const MEMORY_FILE_SCOPE: Record<string, FileScope> = {
  "TRADING-STRATEGY.md": { scope: "per-bot" },
  "TRADE-LOG.md": { scope: "per-bot" },
  "RUN-LOG.jsonl": { scope: "per-bot" },
  "BENCHMARK.md": { scope: "per-bot" },
  "RESEARCH-LOG.md": { scope: "per-bot" },
  "SECTOR-LEDGER.md": { scope: "per-bot" },
  "WEEKLY-REVIEW.md": { scope: "per-bot" },
  "EARNINGS-CALENDAR.md": { scope: "per-bot" },
  "BACKTEST-RESULTS.md": { scope: "per-bot" },
  "BACKTEST-RESULTS.json": { scope: "per-bot" },
  ".price-monitor-state.json": { scope: "per-bot-runtime", gitignored: true },
  "DAILY-SUMMARY.md": { scope: "shared" },
  "SECTOR-MAP.md": { scope: "shared" },
  "ECONOMIC-CALENDAR.md": { scope: "shared" },
  "MARKET-EARNINGS.md": { scope: "shared" },
  "PERPLEXITY-LOG.md": { scope: "shared" },
  "DASHBOARD-AUDIT.jsonl": { scope: "shared" },
  "dashboard-settings.json": { scope: "shared" },
  "WATCHLIST.md": { scope: "shared" },
  "EARNINGS-PINGS.md": { scope: "shared" },
};

export function memoryFileScope(file: string): FileScope {
  const scope = MEMORY_FILE_SCOPE[file];
  if (!scope) {
    throw new Error(
      `memoryPath: unknown memory file "${file}". Add it to MEMORY_FILE_SCOPE in lib/memoryPath.ts.`
    );
  }
  return scope;
}

/** Non-throwing predicate for the watcher: a file change is worth surfacing
 *  as a `MemoryEvent` only if the bare filename is registered. Backtest
 *  snapshots (`backtests/<id>.json`), settings backups, and other untracked
 *  json files would otherwise trigger SSE flushes that no client cares about. */
export function isKnownMemoryFile(file: string): boolean {
  return Object.prototype.hasOwnProperty.call(MEMORY_FILE_SCOPE, file);
}

export function resolveMemoryFile(file: string, ctx?: MemoryCtx): string {
  const scope = memoryFileScope(file);
  if (scope.scope === "shared") {
    return path.join(SHARED_MEMORY_DIR, file);
  }
  if (!ctx) {
    throw new Error(
      `memoryPath: per-bot file "${file}" requires a bot ctx. Pass { bot: "live" | "paper" }.`
    );
  }
  return path.join(botMemoryDir(ctx.bot, ctx.strategy), file);
}

/** mtime-keyed read cache. The dashboard re-reads the same memory files on
 *  every server render (account-switch, router.refresh, SWR revalidation) — at
 *  6+ files per request that's the dominant cost on / and /journal. Keeping the
 *  parsed bytes keyed by mtime means subsequent reads pay only a stat syscall
 *  when nothing has changed, and we always re-read on real edits because mtime
 *  bumps. globalThis-scoped so it survives Next dev HMR module reloads. */
type MemoryCacheEntry = { mtimeMs: number; content: string };
declare global {
  // eslint-disable-next-line no-var
  var __memoryReadCache: Map<string, MemoryCacheEntry> | undefined;
}
function memoryCache(): Map<string, MemoryCacheEntry> {
  if (!globalThis.__memoryReadCache) globalThis.__memoryReadCache = new Map();
  return globalThis.__memoryReadCache;
}

export async function readMemory(file: string, ctx?: MemoryCtx): Promise<string> {
  const filePath = resolveMemoryFile(file, ctx);
  const cache = memoryCache();
  try {
    const stat = await fs.stat(filePath);
    const cached = cache.get(filePath);
    if (cached && cached.mtimeMs === stat.mtimeMs) {
      return cached.content;
    }
    const content = await fs.readFile(filePath, "utf8");
    cache.set(filePath, { mtimeMs: stat.mtimeMs, content });
    return content;
  } catch {
    cache.delete(filePath);
    return "";
  }
}

export const MEMORY_FILES = [
  "BENCHMARK.md",
  "TRADE-LOG.md",
  "SECTOR-LEDGER.md",
  "SECTOR-MAP.md",
  "RESEARCH-LOG.md",
  "WEEKLY-REVIEW.md",
  "TRADING-STRATEGY.md",
  "RUN-LOG.jsonl",
  "PERPLEXITY-LOG.md",
] as const;
