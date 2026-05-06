import { NextResponse, type NextRequest } from "next/server";
import path from "node:path";
import fs from "node:fs/promises";
import { BOT_ROOT } from "@/lib/memoryPath";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

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

export type SyncStatusBody = {
  startedAt?: string;
  finishedAt?: string;
  exitCode?: number;
  trigger?: string;
  message?: string;
};

/** Audit NA6 — paired with the fire-and-forget POST `/api/sync`. Returns
 *  whatever cron-sync.sh has written to `.cron-sync-status.json` last
 *  (covers both manual and launchd-cron runs). The MemorySyncButton polls
 *  this until `finishedAt` advances past the wall-clock at which the user
 *  pressed the button. */
export async function GET(req: NextRequest) {
  if (!isLoopbackHost(req.headers.get("host"))) {
    return NextResponse.json(
      { ok: false, error: "sync status only available from localhost" },
      { status: 403 }
    );
  }
  const statusFile = path.join(BOT_ROOT, ".cron-sync-status.json");
  let status: SyncStatusBody | null = null;
  try {
    const raw = await fs.readFile(statusFile, "utf8");
    status = JSON.parse(raw) as SyncStatusBody;
  } catch {
    status = null;
  }
  return NextResponse.json(
    { ok: true, status },
    { headers: { "Cache-Control": "no-store" } }
  );
}
