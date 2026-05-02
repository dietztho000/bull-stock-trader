import clsx from "clsx";
import { loadMemoryFreshness } from "@/lib/memoryFreshness";
import { fmtRelativeTime } from "@/lib/format";
import { fmtDateTimeCT } from "@/lib/time";

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
  const mtimeStamp =
    f.syncMtimeMs != null ? fmtDateTimeCT(f.syncMtimeMs) : "—";
  const detail =
    f.latestRowDate === f.todayCT
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
        `Sync: ${mtimeStamp} CT (${ageLabel} ago)`,
        `Latest BENCHMARK row: ${f.latestRowDate ?? "—"}`,
        `Today (CT): ${f.todayCT}${f.isTradingDay ? "" : " · non-trading day"}`,
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
