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

const MAX_DURATION_MS = 60_000;

export async function POST(req: NextRequest) {
  if (!isLoopbackHost(req.headers.get("host"))) {
    return NextResponse.json(
      { ok: false, error: "manual-sync only available from localhost" },
      { status: 403 }
    );
  }

  const script = path.join(BOT_ROOT, "scripts", "cron-sync.sh");

  // Append to the same logs launchd writes to so all sync runs (cron +
  // manual) live in one place — matches the documented `tail -f` flow in
  // com.bullstocktrader.cloud-sync.plist.
  const outStream = fs.createWriteStream(SYNC_LOG_OUT, { flags: "a" });
  const errStream = fs.createWriteStream(SYNC_LOG_ERR, { flags: "a" });

  const result = await new Promise<{
    exitCode: number;
    timedOut: boolean;
  }>((resolve) => {
    const child = spawn("bash", [script], {
      cwd: BOT_ROOT,
      env: { ...process.env, CRON_SYNC_TRIGGER: "manual" },
      stdio: ["ignore", "pipe", "pipe"],
    });

    child.stdout.pipe(outStream);
    child.stderr.pipe(errStream);

    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      resolve({ exitCode: -1, timedOut: true });
    }, MAX_DURATION_MS);

    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ exitCode: code ?? -1, timedOut: false });
    });
    child.on("error", () => {
      clearTimeout(timer);
      resolve({ exitCode: -1, timedOut: false });
    });
  });

  outStream.end();
  errStream.end();

  // Read the status file the script just wrote so the client gets the same
  // `message` field the dashboard pill reads — single source of truth.
  let status: Record<string, unknown> | null = null;
  try {
    const raw = fs.readFileSync(
      path.join(BOT_ROOT, ".cron-sync-status.json"),
      "utf8"
    );
    status = JSON.parse(raw);
  } catch {
    status = null;
  }

  if (result.timedOut) {
    return NextResponse.json(
      {
        ok: false,
        error: `cron-sync.sh exceeded ${MAX_DURATION_MS / 1000}s — killed`,
        status,
      },
      { status: 504 }
    );
  }

  return NextResponse.json({
    ok: result.exitCode === 0,
    exitCode: result.exitCode,
    status,
  });
}
