import path from "node:path";
import chokidar, { type FSWatcher } from "chokidar";
import { MEMORY_ROOT, isKnownMemoryFile } from "./memoryPath";

export type MemoryEvent = {
  /** Absolute path that changed. */
  path: string;
  /** Path relative to memory/ — e.g. `momentum-10k/default/BENCHMARK.md` or `shared/SECTOR-MAP.md`. */
  relPath: string;
  /** Bare filename — e.g. `BENCHMARK.md`. */
  file: string;
  /** Bot id the write belongs to (any registered slug, including "live" /
   *  "paper"), or "shared" / null if outside the per-bot tree. */
  bot: string | "shared" | null;
  /** Strategy slug under the bot, or null. */
  strategy: string | null;
};

/** A debounced batch of memory events. The SSE stream sends one of these
 *  per ~500ms window so a 50-file flush from a routine doesn't trigger 50
 *  `router.refresh()` round-trips on every connected client (audit P4). */
export type MemoryBatch = {
  /** Wall-clock when the first event in the batch landed. */
  firstAt: number;
  /** Distinct bot ids touched (includes "shared" + null buckets). */
  bots: string[];
  /** All events in the window, oldest first. Capped to 256 to keep the SSE
   *  payload bounded — a bigger flush is just truncated; clients only need
   *  to know "something changed for these bots." */
  events: MemoryEvent[];
};

type Listener = (batch: MemoryBatch) => void;

type WatcherState = {
  watcher: FSWatcher;
  subs: Set<Listener>;
  knownBots: Set<string>;
  pending: MemoryEvent[];
  flushTimer: NodeJS.Timeout | null;
};

declare global {
  // eslint-disable-next-line no-var
  var __memoryWatcher: WatcherState | undefined;
}

const WATCHED_EXTS = new Set([".md", ".jsonl", ".json"]);
const DEBOUNCE_MS = 500;
const MAX_BATCH = 256;

/** Pulls the current set of registered bot ids. Lazy-imported to avoid the
 *  circular settings → memoryPath import path the watcher would otherwise
 *  pull in at module load. The result is cached on `globalThis.__memoryWatcher`
 *  and refreshed whenever `dashboard-settings.json` changes. */
async function loadKnownBots(): Promise<Set<string>> {
  try {
    const { listBots } = await import("./settings");
    const bots = await listBots();
    return new Set(bots.map((b) => b.id));
  } catch {
    return new Set();
  }
}

function classify(absPath: string, knownBots: Set<string>): MemoryEvent | null {
  const relPath = path.relative(MEMORY_ROOT, absPath);
  if (relPath.startsWith("..")) return null;
  const ext = path.extname(relPath);
  if (!WATCHED_EXTS.has(ext)) return null;
  const segments = relPath.split(path.sep);
  const file = segments[segments.length - 1];
  // Filter to registry-known filenames so backtest snapshot dumps
  // (memory/<bot>/<strategy>/backtests/<id>.json) and settings backups
  // don't trigger SSE flushes no client cares about.
  if (!isKnownMemoryFile(file)) return null;
  if (segments[0] === "shared") {
    return { path: absPath, relPath, file, bot: "shared", strategy: null };
  }
  // Registry-aware: any first-segment matching a registered bot id is
  // per-bot — so `memory/momentum-10k/default/TRADE-LOG.md` no longer
  // classifies as `bot: null` (audit A6). The legacy `live`/`paper`
  // ids are themselves registry entries after seedFromEnv runs.
  if (segments.length >= 3 && knownBots.has(segments[0])) {
    return {
      path: absPath,
      relPath,
      file,
      bot: segments[0],
      strategy: segments[1],
    };
  }
  // Unknown layout — surface so listeners can still react and the layout
  // warning fires once via readMemory.
  return { path: absPath, relPath, file, bot: null, strategy: null };
}

function flushBatch(state: WatcherState) {
  state.flushTimer = null;
  if (state.pending.length === 0) return;
  const events = state.pending.splice(0, state.pending.length);
  const trimmed = events.length > MAX_BATCH ? events.slice(0, MAX_BATCH) : events;
  const bots = Array.from(
    new Set(trimmed.map((e) => e.bot).filter((b): b is string => b != null))
  );
  const batch: MemoryBatch = {
    firstAt: Date.now(),
    bots,
    events: trimmed,
  };
  state.subs.forEach((cb) => cb(batch));
}

function init() {
  if (globalThis.__memoryWatcher) return globalThis.__memoryWatcher;
  const watcher = chokidar.watch(MEMORY_ROOT, {
    ignoreInitial: true,
    persistent: true,
    awaitWriteFinish: { stabilityThreshold: 200, pollInterval: 80 },
  });
  const state: WatcherState = {
    watcher,
    subs: new Set<Listener>(),
    knownBots: new Set<string>(),
    pending: [],
    flushTimer: null,
  };
  // Prime the bot registry async; until it resolves, classify falls through
  // to bot:null which is safe (legacy behavior).
  loadKnownBots().then((bots) => {
    state.knownBots = bots;
  });
  const fire = (absPath: string) => {
    const ev = classify(absPath, state.knownBots);
    if (!ev) return;
    // dashboard-settings.json mutations re-fan the registry so a freshly
    // created bot's writes get classified correctly within seconds (rather
    // than the next process restart).
    if (ev.file === "dashboard-settings.json") {
      loadKnownBots().then((bots) => {
        state.knownBots = bots;
      });
    }
    state.pending.push(ev);
    if (state.flushTimer == null) {
      state.flushTimer = setTimeout(() => flushBatch(state), DEBOUNCE_MS);
    }
  };
  watcher.on("change", fire);
  watcher.on("add", fire);
  globalThis.__memoryWatcher = state;
  return state;
}

export function subscribe(cb: Listener): () => void {
  const { subs } = init();
  subs.add(cb);
  return () => subs.delete(cb);
}
