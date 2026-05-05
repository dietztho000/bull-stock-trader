import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

// memoryPath computes ROOT at module-load time off process.cwd(). To keep the
// tests hermetic without forking a vitest process per file, we set up the
// tmp tree + chdir BEFORE the module loads, then dynamically import.
let tmpRoot: string;
let originalCwd: string;
type MemoryPathModule = typeof import("../memoryPath");
let mp: MemoryPathModule;

beforeAll(async () => {
  originalCwd = process.cwd();
  tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), "memoryPath-test-"));
  await fs.mkdir(path.join(tmpRoot, "dashboard"), { recursive: true });
  await fs.mkdir(path.join(tmpRoot, "memory", "shared"), { recursive: true });
  await fs.mkdir(path.join(tmpRoot, "memory", "live", "default"), { recursive: true });
  process.chdir(path.join(tmpRoot, "dashboard"));
  // Now import — the module captures process.cwd() into its ROOT.
  mp = await import("../memoryPath");
});

afterAll(async () => {
  process.chdir(originalCwd);
  await fs.rm(tmpRoot, { recursive: true, force: true });
});

beforeEach(() => {
  // Reset the global cache between tests so each one starts cold.
  (globalThis as { __memoryReadCache?: Map<string, unknown> }).__memoryReadCache = new Map();
});

describe("readMemory mtime cache", () => {
  it("returns empty string for a missing file", async () => {
    const out = await mp.readMemory("DAILY-SUMMARY.md");
    expect(out).toBe("");
  });

  it("populates the cache on first read; second read serves the same content", async () => {
    const filePath = path.join(tmpRoot, "memory", "shared", "DAILY-SUMMARY.md");
    await fs.writeFile(filePath, "## 2026-05-05\nFirst entry\n");

    const cache = (globalThis as { __memoryReadCache?: Map<string, unknown> })
      .__memoryReadCache;
    expect(cache?.size).toBe(0);

    const first = await mp.readMemory("DAILY-SUMMARY.md");
    expect(first).toContain("First entry");
    expect(cache?.size).toBe(1);

    const second = await mp.readMemory("DAILY-SUMMARY.md");
    expect(second).toBe(first);
    // Still 1 cache entry — the second read didn't churn it.
    expect(cache?.size).toBe(1);
  });

  it("re-reads when mtime changes", async () => {
    const filePath = path.join(tmpRoot, "memory", "shared", "DAILY-SUMMARY.md");
    await fs.writeFile(filePath, "v1\n");
    const first = await mp.readMemory("DAILY-SUMMARY.md");
    expect(first).toBe("v1\n");

    await new Promise((r) => setTimeout(r, 20));
    await fs.writeFile(filePath, "v2\n");
    const future = new Date(Date.now() + 1000);
    await fs.utimes(filePath, future, future);

    const second = await mp.readMemory("DAILY-SUMMARY.md");
    expect(second).toBe("v2\n");
  });

  it("clears cache entry when file disappears", async () => {
    const filePath = path.join(tmpRoot, "memory", "shared", "DAILY-SUMMARY.md");
    await fs.writeFile(filePath, "present\n");
    expect(await mp.readMemory("DAILY-SUMMARY.md")).toBe("present\n");
    await fs.rm(filePath);
    expect(await mp.readMemory("DAILY-SUMMARY.md")).toBe("");
  });
});

describe("MEMORY_FILE_SCOPE registry", () => {
  it("throws when resolving an unregistered file (catches DAILY-SUMMARY-style orphans)", () => {
    expect(() =>
      mp.resolveMemoryFile("UNREGISTERED.md", { bot: "live" })
    ).toThrowError(/unknown memory file/);
  });

  it("requires a bot ctx for per-bot files", () => {
    expect(() => mp.resolveMemoryFile("RESEARCH-LOG.md")).toThrowError(/requires a bot ctx/);
  });

  it("resolves shared files to memory/shared/", () => {
    const out = mp.resolveMemoryFile("DAILY-SUMMARY.md");
    expect(out).toBe(path.join(mp.MEMORY_ROOT, "shared", "DAILY-SUMMARY.md"));
  });

  it("resolves per-bot files under the bot directory", () => {
    const out = mp.resolveMemoryFile("TRADE-LOG.md", { bot: "live", strategy: "default" });
    expect(out).toBe(path.join(mp.MEMORY_ROOT, "live", "default", "TRADE-LOG.md"));
  });
});
