"use client";

import useSWR from "swr";
import clsx from "clsx";
import { useState } from "react";
import { fmtWeekdayTimeCT } from "@/lib/time";

type JobStatus = {
  label: string;
  description: string;
  lastRunIso: string | null;
  ok: boolean;
  errBytes: number;
  errTail?: string;
  installed: boolean;
};

const fetcher = (u: string) => fetch(u).then((r) => r.json());

/** Audit F11 — surfaces last-run time + ok/fail for the three local launchd
 *  jobs (cloud-sync, log-rotate, price-monitor). Without this tile a stuck
 *  cron-sync is invisible until the user notices stale dashboard data. */
export function LaunchdStatusTile() {
  const { data } = useSWR<{ jobs: JobStatus[] }>("/api/health/launchd", fetcher, {
    refreshInterval: 30_000,
    revalidateOnFocus: true,
    keepPreviousData: true,
  });
  const jobs = data?.jobs ?? [];

  return (
    <section
      className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-md"
      aria-label="launchd job health"
    >
      <header className="mb-3 flex items-baseline justify-between">
        <h3 className="text-sm font-medium text-white/90">launchd jobs</h3>
        <span className="text-xs text-white/40">
          ~/Library/Logs/bull-stock-trader-*.log
        </span>
      </header>
      <ul className="space-y-2">
        {jobs.length === 0 ? (
          <li className="text-xs text-white/50">Loading…</li>
        ) : (
          jobs.map((job) => <JobRow key={job.label} job={job} />)
        )}
      </ul>
    </section>
  );
}

function JobRow({ job }: { job: JobStatus }) {
  const [expanded, setExpanded] = useState(false);
  const tone = !job.installed
    ? "missing"
    : job.ok
      ? "ok"
      : "error";

  return (
    <li className="rounded-lg bg-black/20 px-3 py-2">
      <div className="flex items-center gap-3">
        <span
          aria-label={tone === "ok" ? "ok" : tone === "error" ? "error" : "not installed"}
          className={clsx(
            "h-2.5 w-2.5 shrink-0 rounded-full",
            tone === "ok" && "bg-emerald-400",
            tone === "error" && "bg-rose-400",
            tone === "missing" && "bg-white/20"
          )}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-sm font-medium text-white/90">{job.label}</span>
            <span className="text-xs text-white/50">
              {job.lastRunIso
                ? fmtWeekdayTimeCT(job.lastRunIso)
                : job.installed
                  ? "—"
                  : "not installed"}
            </span>
          </div>
          <p className="text-xs text-white/40">{job.description}</p>
          {tone === "error" && job.errTail ? (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="mt-1 text-xs text-rose-300 hover:text-rose-200 underline-offset-2 hover:underline"
            >
              {expanded ? "Hide error" : `Show error (${job.errBytes} bytes)`}
            </button>
          ) : null}
        </div>
      </div>
      {expanded && job.errTail ? (
        <pre className="mt-2 max-h-48 overflow-auto rounded bg-black/40 p-2 text-[10px] leading-snug text-rose-200/80 whitespace-pre-wrap">
          {job.errTail}
        </pre>
      ) : null}
    </li>
  );
}
