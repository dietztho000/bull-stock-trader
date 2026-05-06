import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

// Hermetic-fs setup mirrors memoryPath.test.ts — chdir before importing so
// memoryPath's ROOT captures the tmp tree.
let tmpRoot: string;
let originalCwd: string;
type FreshnessModule = typeof import("../memoryFreshness");
let mod: FreshnessModule;

beforeAll(async () => {
  originalCwd = process.cwd();
  tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), "memoryFreshness-test-"));
  await fs.mkdir(path.join(tmpRoot, "dashboard"), { recursive: true });
  await fs.mkdir(path.join(tmpRoot, "memory", "live", "default"), {
    recursive: true,
  });
  process.chdir(path.join(tmpRoot, "dashboard"));
  mod = await import("../memoryFreshness");
});

afterAll(async () => {
  process.chdir(originalCwd);
  await fs.rm(tmpRoot, { recursive: true, force: true });
});

beforeEach(async () => {
  await fs
    .rm(path.join(tmpRoot, ".cron-sync-status.json"), { force: true })
    .catch(() => {});
  await fs
    .rm(path.join(tmpRoot, "memory", "live", "default", "BENCHMARK.md"), {
      force: true,
    })
    .catch(() => {});
  (globalThis as { __memoryReadCache?: Map<string, unknown> }).__memoryReadCache =
    new Map();
});

const STATUS_PATH = () => path.join(tmpRoot, ".cron-sync-status.json");

describe("loadMemoryFreshness — cron status file", () => {
  it("falls back to 'unknown' when status file is missing", async () => {
    const out = await mod.loadMemoryFreshness({ bot: "live" });
    expect(out.lastSyncMs).toBeNull();
    expect(out.lastSyncStatus).toBe("unknown");
    expect(out.lastSyncMessage).toBeNull();
    expect(out.lastSyncTrigger).toBeNull();
  });

  it("reports 'ok' with finishedAt when exitCode is 0", async () => {
    await fs.writeFile(
      STATUS_PATH(),
      JSON.stringify({
        startedAt: "2026-05-05T12:00:00Z",
        finishedAt: "2026-05-05T12:00:03Z",
        exitCode: 0,
        trigger: "launchd",
        message: "done",
      })
    );
    const out = await mod.loadMemoryFreshness({ bot: "live" });
    expect(out.lastSyncStatus).toBe("ok");
    expect(out.lastSyncTrigger).toBe("launchd");
    expect(out.lastSyncMessage).toBe("done");
    expect(out.lastSyncMs).toBe(Date.parse("2026-05-05T12:00:03Z"));
  });

  it("reports 'error' when exitCode is non-zero", async () => {
    await fs.writeFile(
      STATUS_PATH(),
      JSON.stringify({
        startedAt: "2026-05-05T12:00:00Z",
        finishedAt: "2026-05-05T12:00:03Z",
        exitCode: 1,
        trigger: "manual",
        message: "git pull failed",
      })
    );
    const out = await mod.loadMemoryFreshness({ bot: "live" });
    expect(out.lastSyncStatus).toBe("error");
    expect(out.lastSyncTrigger).toBe("manual");
    expect(out.lastSyncMessage).toBe("git pull failed");
    // An errored sync forces the dot to stale even if BENCHMARK.md is fresh.
    expect(out.status).toBe("stale");
  });

  it("reports 'running' when finishedAt is null (in-flight marker)", async () => {
    await fs.writeFile(
      STATUS_PATH(),
      JSON.stringify({
        startedAt: "2026-05-05T12:00:00Z",
        finishedAt: null,
        exitCode: null,
        trigger: "manual",
        message: "running",
      })
    );
    const out = await mod.loadMemoryFreshness({ bot: "live" });
    expect(out.lastSyncStatus).toBe("running");
    expect(out.lastSyncMs).toBe(Date.parse("2026-05-05T12:00:00Z"));
  });

  it("reports 'unknown' with a hint when the status file is corrupt", async () => {
    await fs.writeFile(STATUS_PATH(), "{ not valid json");
    const out = await mod.loadMemoryFreshness({ bot: "live" });
    expect(out.lastSyncStatus).toBe("unknown");
    expect(out.lastSyncMessage).toBe("status file corrupt");
  });

  it("forces status to stale when the last successful sync is >30 min old", async () => {
    const oldMs = Date.now() - 31 * 60 * 1000;
    await fs.writeFile(
      STATUS_PATH(),
      JSON.stringify({
        startedAt: new Date(oldMs - 3000).toISOString(),
        finishedAt: new Date(oldMs).toISOString(),
        exitCode: 0,
        trigger: "launchd",
        message: "done",
      })
    );
    // Make BENCHMARK.md look fresh (today, written seconds ago) so the dot
    // would be green if we only looked at data freshness.
    const benchPath = path.join(
      tmpRoot,
      "memory",
      "live",
      "default",
      "BENCHMARK.md"
    );
    await fs.writeFile(
      benchPath,
      `## YTD vs SPY\n| Date | Bot | SPY |\n|---|---|---|\n| ${new Date().toISOString().slice(0, 10)} | 1.0 | 0.5 |\n`
    );

    const out = await mod.loadMemoryFreshness({ bot: "live" });
    // ok status but stale age → warn (not stale, since exitCode was 0).
    expect(out.lastSyncStatus).toBe("ok");
    expect(out.status).not.toBe("fresh");
  });
});

describe("loadMemoryFreshness — dataWriteMs", () => {
  it("picks up a memory file's mtime, not the status file", async () => {
    const benchPath = path.join(
      tmpRoot,
      "memory",
      "live",
      "default",
      "BENCHMARK.md"
    );
    await fs.writeFile(benchPath, "## YTD\n");
    const out = await mod.loadMemoryFreshness({ bot: "live" });
    expect(out.dataWriteMs).not.toBeNull();
    expect(out.dataWriteMs).toBeGreaterThan(Date.now() - 60_000);
  });

  it("returns null dataWriteMs when no per-bot data files exist", async () => {
    const out = await mod.loadMemoryFreshness({ bot: "live" });
    expect(out.dataWriteMs).toBeNull();
  });

  it("uses the newest mtime across data files (TRADE-LOG newer than BENCHMARK)", async () => {
    const dir = path.join(tmpRoot, "memory", "live", "default");
    const benchPath = path.join(dir, "BENCHMARK.md");
    const tradePath = path.join(dir, "TRADE-LOG.md");
    await fs.writeFile(benchPath, "## YTD\n");
    // Backdate BENCHMARK by 24h, then write TRADE-LOG fresh.
    const oldMs = Date.now() - 24 * 60 * 60 * 1000;
    await fs.utimes(benchPath, oldMs / 1000, oldMs / 1000);
    await fs.writeFile(tradePath, "## Trades\n");

    const out = await mod.loadMemoryFreshness({ bot: "live" });
    expect(out.dataWriteMs).not.toBeNull();
    // dataWriteMs should reflect the fresh TRADE-LOG, not yesterday's BENCHMARK.
    expect(out.dataWriteMs!).toBeGreaterThan(Date.now() - 60_000);

    await fs.rm(tradePath, { force: true });
  });
});
