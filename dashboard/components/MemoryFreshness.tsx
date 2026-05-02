import clsx from "clsx";
import { loadMemoryFreshness } from "@/lib/memoryFreshness";
import { fmtRelativeTime } from "@/lib/format";

const DOT: Record<"fresh" | "warn" | "stale", string> = {
  fresh: "bg-[var(--color-up)]",
  warn: "bg-[var(--color-warn)]",
  stale: "bg-[var(--color-down)]",
};

const TINT: Record<"fresh" | "warn" | "stale", string> = {
  fresh: "",
  warn: "glass-tint-warn",
  stale: "glass-tint-down",
};

export async function MemoryFreshness() {
  const f = await loadMemoryFreshness();
  const ageLabel = f.syncMtimeMs != null ? fmtRelativeTime(f.syncMtimeMs) : "—";
  const mtimeIso =
    f.syncMtimeMs != null ? new Date(f.syncMtimeMs).toISOString().slice(0, 16).replace("T", " ") : "—";
  const detail =
    f.latestRowDate === f.todayET
      ? "today"
      : f.latestRowDate
        ? `row ${f.latestRowDate}`
        : "no rows";

  return (
    <div
      className={clsx(
        "glass rounded-full px-3 py-1.5 inline-flex items-center gap-2",
        TINT[f.status]
      )}
      title={[
        `Sync: ${mtimeIso} UTC (${ageLabel} ago)`,
        `Latest BENCHMARK row: ${f.latestRowDate ?? "—"}`,
        `Today (ET): ${f.todayET}${f.isTradingDay ? "" : " · non-trading day"}`,
      ].join("\n")}
    >
      <span className={clsx("w-2 h-2 rounded-full", DOT[f.status])} />
      <span className="text-xs font-semibold tracking-wide">Memory</span>
      <span className="text-[10px] uppercase tracking-[0.12em] text-[var(--color-muted)]">
        {ageLabel} · {detail}
      </span>
    </div>
  );
}
