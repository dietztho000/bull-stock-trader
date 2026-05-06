import { NextResponse, type NextRequest } from "next/server";
import { spawn } from "node:child_process";
import path from "node:path";
import os from "node:os";
import fs from "node:fs";
import { BOT_ROOT } from "@/lib/memoryPath";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** This endpoint shells out to bash, so it must never be reachable from
 *  outside the user's machine. Next dev binds to localhost by default but
 *  `next start --hostname 0.0.0.0` doesn't, and a misconfigured reverse
 *  proxy could forward arbitrary requests through. Belt-and-suspenders. */
function isLoopbackHost(host: string | null): boolean {
  if (!host) return false;
  const hostname = host.split(":")[0]!.toLowerCase();
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "[::1]" ||
    hostname === "::1"
  );
}

const SYNC_LOG_OUT = path.join(
  os.homedir(),
  "Library/Logs/bull-stock-trader-sync.out.log"
);
const SYNC_LOG_ERR = path.join(
  os.homedir(),
  "Library/Logs/bull-stock-trader-sync.err.log"
);

/** Audit NA6 — fire-and-forget. cron-sync.sh holds `.git/.commit-lock`
 *  so concurrent invocations serialize safely; we spawn the child without
 *  awaiting so the Next.js function returns immediately. The client polls
 *  `/api/sync/status` until `.cron-sync-status.json#finishedAt` advances
 *  past the wall-clock the request was issued. */
export async function POST(req: NextRequest) {
  if (!isLoopbackHost(req.headers.get("host"))) {
    return NextResponse.json(
      { ok: false, error: "manual-sync only available from localhost" },
      { status: 403 }
    );
  }

  const script = path.join(BOT_ROOT, "scripts", "cron-sync.sh");
  const triggeredAt = new Date().toISOString();

  // Append to the same logs launchd writes to so all sync runs (cron +
  // manual) live in one place — matches the documented `tail -f` flow in
  // com.bullstocktrader.cloud-sync.plist.
  const outStream = fs.createWriteStream(SYNC_LOG_OUT, { flags: "a" });
  const errStream = fs.createWriteStream(SYNC_LOG_ERR, { flags: "a" });

  try {
    const child = spawn("bash", [script], {
      cwd: BOT_ROOT,
      env: { ...process.env, CRON_SYNC_TRIGGER: "manual" },
      stdio: ["ignore", "pipe", "pipe"],
    });
    child.stdout.pipe(outStream);
    child.stderr.pipe(errStream);
    child.on("close", () => {
      outStream.end();
      errStream.end();
    });
    child.on("error", () => {
      outStream.end();
      errStream.end();
    });
    return NextResponse.json(
      { ok: true, started: true, triggeredAt, pid: child.pid ?? null },
      { status: 202 }
    );
  } catch (err) {
    outStream.end();
    errStream.end();
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}
