import clsx from "clsx";
import { loadMemoryFreshness } from "@/lib/memoryFreshness";
import { fmtRelativeTime } from "@/lib/format";
import { fmtDateTimeCT } from "@/lib/time";
import type { BotId } from "@/lib/alpacaMode";
import { MemorySyncButton } from "@/components/MemorySyncButton";

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

export async function MemoryFreshness({ botId }: { botId: BotId }) {
  const f = await loadMemoryFreshness({ bot: botId });

  const pullLabel = f.lastSyncMs != null ? fmtRelativeTime(f.lastSyncMs) : "—";
  const dataLabel = f.dataWriteMs != null ? fmtRelativeTime(f.dataWriteMs) : "—";
  const pullStamp = f.lastSyncMs != null ? fmtDateTimeCT(f.lastSyncMs) : "—";
  const dataStamp = f.dataWriteMs != null ? fmtDateTimeCT(f.dataWriteMs) : "—";

  const tooltipLines = [
    `Last pull: ${pullStamp} CT (${pullLabel} ago) [${f.lastSyncStatus}${f.lastSyncTrigger ? `, ${f.lastSyncTrigger}` : ""}]`,
    f.lastSyncMessage ? `  → ${f.lastSyncMessage}` : null,
    `Last data write (any memory file): ${dataStamp} CT (${dataLabel} ago)`,
    `Latest BENCHMARK row: ${f.latestRowDate ?? "—"}`,
    `Today (CT): ${f.todayCT}${f.isTradingDay ? "" : " · non-trading day"}`,
  ].filter(Boolean) as string[];

  return (
    <div
      className={clsx(
        "glass rounded-full pl-3 pr-1.5 py-1 inline-flex items-center gap-2",
        TINT[f.status]
      )}
      title={tooltipLines.join("\n")}
    >
      <span className={clsx("w-2 h-2 rounded-full", DOT[f.status])} />
      <span className="text-xs font-semibold tracking-wide">Memory</span>
      <span className="text-[10px] uppercase tracking-[0.10em] text-[var(--color-muted)] flex items-center gap-1.5">
        <span>
          <span className="opacity-70">PULL</span> {pullLabel}
        </span>
        <span className="opacity-40">·</span>
        <span>
          <span className="opacity-70">DATA</span> {dataLabel}
        </span>
      </span>
      <MemorySyncButton initialStatus={f.lastSyncStatus} />
    </div>
  );
}
