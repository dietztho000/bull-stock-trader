import { NextResponse } from "next/server";
import { stat, readFile } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** GET /api/health/launchd
 *
 *  Reads the three launchd jobs' stdout/stderr log files in ~/Library/Logs
 *  and reports per-job last-run-at + ok/fail. The dashboard's /bots page
 *  surfaces these so a stuck cron-sync or price-monitor is visible without
 *  hunting through logs (audit F11). Read-only — does not require any
 *  Alpaca credentials and is safe to poll on a 30s SWR. */

type Job = {
  label: string;
  description: string;
  outLog: string;
  errLog: string;
};

const LOG_DIR = path.join(homedir(), "Library", "Logs");

const JOBS: Job[] = [
  {
    label: "cloud-sync",
    description: "Backfills cloud-routine memory writes into local main (15m).",
    outLog: path.join(LOG_DIR, "bull-stock-trader-sync.out.log"),
    errLog: path.join(LOG_DIR, "bull-stock-trader-sync.err.log"),
  },
  {
    label: "log-rotate",
    description: "Trims ~/Library/Logs/bull-stock-trader-*.log to 1000 lines (daily 02:00).",
    outLog: path.join(LOG_DIR, "bull-stock-trader-log-rotate.out.log"),
    errLog: path.join(LOG_DIR, "bull-stock-trader-log-rotate.err.log"),
  },
  {
    label: "price-monitor",
    description: "Polls open positions for -5%/-6%/-7% buckets (10m, market hours).",
    outLog: path.join(LOG_DIR, "bull-stock-trader-price-monitor.out.log"),
    errLog: path.join(LOG_DIR, "bull-stock-trader-price-monitor.err.log"),
  },
];

const TAIL_BYTES = 4_096;

type JobStatus = {
  label: string;
  description: string;
  /** ISO timestamp of the most recent stdout or stderr write. Null when
   *  neither file exists (job has never run on this host). */
  lastRunIso: string | null;
  /** true when stderr is empty OR older than stdout's most recent write. */
  ok: boolean;
  /** Size of the err log in bytes — surfaced so the UI can flag "growing". */
  errBytes: number;
  /** Last few hundred bytes of err log when non-empty (truncated). */
  errTail?: string;
  /** When neither log exists, the job is effectively uninstalled. */
  installed: boolean;
};

async function statSafe(p: string) {
  try {
    return await stat(p);
  } catch {
    return null;
  }
}

async function tailFile(p: string, bytes: number): Promise<string | undefined> {
  try {
    const st = await stat(p);
    if (st.size === 0) return undefined;
    const start = Math.max(0, st.size - bytes);
    const fh = await readFile(p);
    return fh.subarray(start).toString("utf8");
  } catch {
    return undefined;
  }
}

async function inspect(job: Job): Promise<JobStatus> {
  const [out, err] = await Promise.all([statSafe(job.outLog), statSafe(job.errLog)]);
  const installed = Boolean(out || err);
  const outMs = out?.mtimeMs ?? 0;
  const errMs = err?.mtimeMs ?? 0;
  const lastRunMs = Math.max(outMs, errMs);
  const lastRunIso = lastRunMs > 0 ? new Date(lastRunMs).toISOString() : null;
  // ok: err is empty, OR err's last write is older than out's last write
  // (the job recovered after a prior failure and stdout has rolled past).
  const errBytes = err?.size ?? 0;
  const ok = errBytes === 0 || (outMs > 0 && outMs >= errMs);
  const errTail = errBytes > 0 ? await tailFile(job.errLog, TAIL_BYTES) : undefined;
  return {
    label: job.label,
    description: job.description,
    lastRunIso,
    ok,
    errBytes,
    errTail,
    installed,
  };
}

export async function GET(): Promise<Response> {
  const jobs = await Promise.all(JOBS.map(inspect));
  return NextResponse.json({ jobs });
}
