"use client";

import useSWR from "swr";
import clsx from "clsx";
import type { SnapshotRow } from "@/app/api/bots/snapshot/route";
import { useLiveSwr } from "@/lib/useLiveSwr";

const fetcher = (u: string) => fetch(u).then((r) => r.json());

/** Cross-bot mood summary line for the mascot tile (audit U4 / U6). With N
 *  bots, the single-bot day-pct flavor stops being a useful read of the
 *  whole fleet — surface a green/red/flat tally instead. Audit U7: also
 *  renders for single-bot installs so the "1 green of 1 bot" reading
 *  still appears (was previously suppressed for fewer than 2 bots).
 *  Backs off to once-per-minute when the market is closed (audit P3).
 *
 *  Audit NU4 — uses the slim `/api/bots/snapshot` endpoint instead of the
 *  full leaderboard payload, since the mood line only consumes `dayPct`.
 *  Skips Alpaca shells + drawdown/ledger compute for every Overview render. */
export function MultiBotMoodLine() {
  const liveOpts = useLiveSwr(60_000);
  const { data } = useSWR<{ rows: SnapshotRow[] }>(
    "/api/bots/snapshot",
    fetcher,
    { ...liveOpts, keepPreviousData: true }
  );

  const rows = (data?.rows ?? []).filter((r) => r.enabled);
  if (rows.length === 0) return null;

  let green = 0;
  let red = 0;
  let flat = 0;
  for (const r of rows) {
    if (r.dayPct == null) {
      flat++;
      continue;
    }
    if (r.dayPct > 0.1) green++;
    else if (r.dayPct < -0.1) red++;
    else flat++;
  }

  // Net mood — drives the small leading dot color so the mascot's strip
  // matches its character (green when most bots are up).
  const tone = green > red ? "up" : red > green ? "down" : "muted";
  const dot =
    tone === "up"
      ? "bg-[var(--color-up)]"
      : tone === "down"
      ? "bg-[var(--color-down)]"
      : "bg-[var(--color-muted)]";

  return (
    <div className="mt-2 mb-3 flex items-center justify-center gap-2 text-[11px] text-[var(--color-muted)]">
      <span className={clsx("inline-block w-1.5 h-1.5 rounded-full", dot)} />
      <span>
        Fleet: {green > 0 && <span className="text-[var(--color-up)]">{green} green</span>}
        {green > 0 && (red > 0 || flat > 0) && " · "}
        {red > 0 && <span className="text-[var(--color-down)]">{red} red</span>}
        {red > 0 && flat > 0 && " · "}
        {flat > 0 && <span>{flat} flat</span>}{" "}
        of {rows.length} bot{rows.length === 1 ? "" : "s"}
      </span>
    </div>
  );
}
