import clsx from "clsx";
import { Kpi } from "@/components/ui/Card";
import { fmtMoney } from "@/lib/format";
import {
  PERPLEXITY_COST_PER_CALL,
  type PerplexitySummary,
} from "@/lib/parsers/perplexityLog";

export type PerplexityCostTileProps = {
  summary: PerplexitySummary;
};

export function PerplexityCostTile({ summary }: PerplexityCostTileProps) {
  const { todayCount, todayCost, yesterdayCount, rolling14dMedian } = summary;

  // Mirror the Discord spike alert: today's count > 2x rolling-14d median.
  // Median 0 (no history) suppresses the warning so a fresh install doesn't
  // light up red.
  const isSpike = rolling14dMedian > 0 && todayCount > 2 * rolling14dMedian;

  const value = todayCount === 0 ? "$0.00" : fmtMoney(todayCost);
  const hint = `${todayCount} call${todayCount === 1 ? "" : "s"} today`;
  const deltaSign = todayCount > yesterdayCount ? "+" : "";
  const deltaValue =
    yesterdayCount === 0 && todayCount === 0
      ? "—"
      : `${deltaSign}${todayCount - yesterdayCount} vs yesterday`;

  return (
    <div className="relative">
      <Kpi
        label="Research API spend"
        value={value}
        delta={
          yesterdayCount === 0 && todayCount === 0
            ? undefined
            : { value: deltaValue, positive: null }
        }
        hint={hint}
      />
      <div
        className={clsx(
          "px-3.5 pb-2.5 -mt-1 text-[10px] tabular text-[var(--color-muted)]",
          "flex items-center justify-between gap-2"
        )}
      >
        <span>
          14d median: <span className="text-[var(--color-text)]">{formatCount(rolling14dMedian)}</span>
        </span>
        {isSpike && (
          <span className="text-[var(--color-warn)] font-medium">⚠ spike</span>
        )}
      </div>
    </div>
  );
}

function formatCount(n: number): string {
  // Median can be a half-integer when the 14-day window has even count parity.
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

// Cost rate is exported here to keep the tile and the Discord daily-summary
// in sync if it ever changes. Re-exporting from the parser module so callers
// of this tile can read the rate without pulling the parser directly.
export { PERPLEXITY_COST_PER_CALL };
