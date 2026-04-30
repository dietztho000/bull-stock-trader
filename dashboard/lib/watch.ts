import chokidar, { type FSWatcher } from "chokidar";
import { MEMORY_DIR } from "./memoryPath";

type Listener = (file: string) => void;

declare global {
  // eslint-disable-next-line no-var
  var __memoryWatcher: { watcher: FSWatcher; subs: Set<Listener> } | undefined;
}

function init() {
  if (globalThis.__memoryWatcher) return globalThis.__memoryWatcher;
  const watcher = chokidar.watch(MEMORY_DIR, {
    ignoreInitial: true,
    persistent: true,
    depth: 0,
    awaitWriteFinish: { stabilityThreshold: 200, pollInterval: 80 },
  });
  const subs = new Set<Listener>();
  const fire = (f: string) => {
    if (!f.endsWith(".md")) return;
    subs.forEach((cb) => cb(f));
  };
  watcher.on("change", fire);
  watcher.on("add", fire);
  globalThis.__memoryWatcher = { watcher, subs };
  return globalThis.__memoryWatcher;
}

export function subscribe(cb: Listener): () => void {
  const { subs } = init();
  subs.add(cb);
  return () => subs.delete(cb);
}
