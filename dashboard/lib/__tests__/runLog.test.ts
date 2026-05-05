import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

let tmpRoot: string;
let originalCwd: string;
type RunLogModule = typeof import("../parsers/runLog");
let mod: RunLogModule;
let logPath: string;

beforeAll(async () => {
  originalCwd = process.cwd();
  tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), "runLog-test-"));
  await fs.mkdir(path.join(tmpRoot, "dashboard"), { recursive: true });
  await fs.mkdir(path.join(tmpRoot, "memory", "live", "default"), {
    recursive: true,
  });
  process.chdir(path.join(tmpRoot, "dashboard"));
  logPath = path.join(tmpRoot, "memory", "live", "default", "RUN-LOG.jsonl");
  mod = await import("../parsers/runLog");
});

afterAll(async () => {
  process.chdir(originalCwd);
  await fs.rm(tmpRoot, { recursive: true, force: true });
});

beforeEach(async () => {
  (globalThis as { __memoryReadCache?: Map<string, unknown> }).__memoryReadCache = new Map();
  await fs.rm(logPath, { force: true });
});

const ctx = { bot: "live", strategy: "default" };

describe("loadRunLog", () => {
  it("returns [] for a missing file", async () => {
    expect(await mod.loadRunLog(ctx)).toEqual([]);
  });

  it("returns [] for an empty file", async () => {
    await fs.writeFile(logPath, "");
    expect(await mod.loadRunLog(ctx)).toEqual([]);
  });

  it("pairs a single start+end run", async () => {
    const lines = [
      JSON.stringify({ ts: "2026-05-05T12:00:00Z", routine: "pre-market", action: "start", status: "ok", git_sha: "abc123" }),
      JSON.stringify({ ts: "2026-05-05T12:03:30Z", routine: "pre-market", action: "end", status: "ok", git_sha: "abc123" }),
    ].join("\n");
    await fs.writeFile(logPath, lines + "\n");

    const runs = await mod.loadRunLog(ctx);
    expect(runs).toHaveLength(1);
    expect(runs[0]).toMatchObject({
      routine: "pre-market",
      startTs: "2026-05-05T12:00:00Z",
      endTs: "2026-05-05T12:03:30Z",
      status: "ok",
      gitSha: "abc123",
    });
    // 3:30 → 210000ms
    expect(runs[0].durationMs).toBe(210_000);
  });

  it("ignores the _seed routine row used for fresh memory init", async () => {
    const lines = [
      JSON.stringify({ ts: "2026-04-30T00:00:00Z", routine: "_seed", action: "start", status: "ok" }),
      JSON.stringify({ ts: "2026-04-30T00:00:00Z", routine: "_seed", action: "end", status: "ok" }),
      JSON.stringify({ ts: "2026-05-05T12:00:00Z", routine: "pre-market", action: "start", status: "ok" }),
      JSON.stringify({ ts: "2026-05-05T12:01:00Z", routine: "pre-market", action: "end", status: "ok" }),
    ].join("\n");
    await fs.writeFile(logPath, lines + "\n");

    const runs = await mod.loadRunLog(ctx);
    expect(runs.map((r) => r.routine)).toEqual(["pre-market"]);
  });

  it("emits an in-flight record for an unpaired start", async () => {
    const lines = [
      JSON.stringify({ ts: "2026-05-05T12:00:00Z", routine: "midday", action: "start", status: "ok" }),
    ].join("\n");
    await fs.writeFile(logPath, lines + "\n");

    const runs = await mod.loadRunLog(ctx);
    expect(runs).toHaveLength(1);
    expect(runs[0].endTs).toBeNull();
    expect(runs[0].durationMs).toBeNull();
  });

  it("handles a second start before the first ends (crash recovery)", async () => {
    // start1, start2 (no end1), end2 — emits the orphan start1 as in-flight,
    // and pairs start2/end2 normally.
    const lines = [
      JSON.stringify({ ts: "2026-05-05T12:00:00Z", routine: "midday", action: "start", status: "ok" }),
      JSON.stringify({ ts: "2026-05-05T12:30:00Z", routine: "midday", action: "start", status: "ok" }),
      JSON.stringify({ ts: "2026-05-05T12:31:00Z", routine: "midday", action: "end", status: "ok" }),
    ].join("\n");
    await fs.writeFile(logPath, lines + "\n");

    const runs = await mod.loadRunLog(ctx);
    expect(runs).toHaveLength(2);
    // Sort is newest-first, so the paired (12:31 end) comes first.
    expect(runs[0].endTs).toBe("2026-05-05T12:31:00Z");
    expect(runs[1].endTs).toBeNull();
    expect(runs[1].startTs).toBe("2026-05-05T12:00:00Z");
  });

  it("normalizes status — 'fail' and 'failed' both become 'error'", async () => {
    const lines = [
      JSON.stringify({ ts: "2026-05-05T10:00:00Z", routine: "auth-canary", action: "start", status: "ok" }),
      JSON.stringify({ ts: "2026-05-05T10:00:30Z", routine: "auth-canary", action: "end", status: "fail" }),
      JSON.stringify({ ts: "2026-05-05T11:00:00Z", routine: "stops", action: "start", status: "ok" }),
      JSON.stringify({ ts: "2026-05-05T11:00:30Z", routine: "stops", action: "end", status: "failed" }),
    ].join("\n");
    await fs.writeFile(logPath, lines + "\n");

    const runs = await mod.loadRunLog(ctx);
    expect(runs.map((r) => r.status).sort()).toEqual(["error", "error"]);
  });

  it("survives malformed JSON lines without throwing", async () => {
    const lines = [
      JSON.stringify({ ts: "2026-05-05T12:00:00Z", routine: "pre-market", action: "start" }),
      "not json at all",
      "{ broken",
      JSON.stringify({ ts: "2026-05-05T12:01:00Z", routine: "pre-market", action: "end", status: "ok" }),
    ].join("\n");
    await fs.writeFile(logPath, lines + "\n");

    const runs = await mod.loadRunLog(ctx);
    expect(runs).toHaveLength(1);
    expect(runs[0].endTs).toBe("2026-05-05T12:01:00Z");
  });

  it("sorts results newest-first by end (or start) timestamp", async () => {
    const lines = [
      JSON.stringify({ ts: "2026-05-05T08:00:00Z", routine: "auth-canary", action: "start", status: "ok" }),
      JSON.stringify({ ts: "2026-05-05T08:00:10Z", routine: "auth-canary", action: "end", status: "ok" }),
      JSON.stringify({ ts: "2026-05-05T15:00:00Z", routine: "afternoon", action: "start", status: "ok" }),
      JSON.stringify({ ts: "2026-05-05T15:01:00Z", routine: "afternoon", action: "end", status: "ok" }),
      JSON.stringify({ ts: "2026-05-05T11:00:00Z", routine: "midday", action: "start", status: "ok" }),
      JSON.stringify({ ts: "2026-05-05T11:01:00Z", routine: "midday", action: "end", status: "ok" }),
    ].join("\n");
    await fs.writeFile(logPath, lines + "\n");

    const runs = await mod.loadRunLog(ctx);
    expect(runs.map((r) => r.routine)).toEqual([
      "afternoon",
      "midday",
      "auth-canary",
    ]);
  });
});

describe("summarizeToday", () => {
  // Convenience: stamps that fall on a given CT calendar date. CT is UTC-5
  // CDT (Apr–Nov) so 2026-05-05 18:00 CDT = 2026-05-05T23:00Z. Anything from
  // 2026-05-05T05:00Z (00:00 CT) through 2026-05-06T04:59Z is "today CT".
  const todayUtc = "2026-05-05T15:00:00Z"; // 10:00 CT on 2026-05-05
  const yesterdayUtc = "2026-05-04T15:00:00Z";

  it("marks fired routines OK when their endTs is on the target CT day", () => {
    const runs = [
      {
        routine: "pre-market",
        startTs: todayUtc,
        endTs: todayUtc,
        status: "ok" as const,
        durationMs: 1000,
        gitSha: null,
      },
    ];
    const summary = mod.summarizeToday(runs, "2026-05-05", false);
    const preMarket = summary.find((s) => s.routine === "pre-market");
    expect(preMarket?.lastRun).not.toBeNull();
    expect(preMarket?.lastRun?.status).toBe("ok");
  });

  it("marks routines without a today-stamped run as null lastRun", () => {
    const runs = [
      {
        routine: "pre-market",
        startTs: yesterdayUtc,
        endTs: yesterdayUtc,
        status: "ok" as const,
        durationMs: 1000,
        gitSha: null,
      },
    ];
    const summary = mod.summarizeToday(runs, "2026-05-05", false);
    expect(summary.find((s) => s.routine === "pre-market")?.lastRun).toBeNull();
  });

  it("appends weekly-review only on Fridays", () => {
    const monday = mod.summarizeToday([], "2026-05-04", false);
    expect(monday.map((s) => s.routine)).not.toContain("weekly-review");

    const friday = mod.summarizeToday([], "2026-05-08", true);
    expect(friday.map((s) => s.routine)).toContain("weekly-review");
  });

  it("includes all 9 daily routines in order", () => {
    const summary = mod.summarizeToday([], "2026-05-05", false);
    expect(summary.map((s) => s.routine)).toEqual([
      "auth-canary",
      "pre-market",
      "market-open",
      "mid-morning",
      "late-morning",
      "midday",
      "stops",
      "afternoon",
      "daily-summary",
    ]);
  });
});
