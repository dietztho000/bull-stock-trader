import { Card, Kpi, Badge } from "@/components/ui/Card";
import { fmtSignedMoney } from "@/lib/format";
import type { BacktestSummary as Summary } from "@/lib/backtest/types";

export function BacktestSummary({ summary }: { summary: Summary | null }) {
  if (!summary || summary.tradeCount === 0) {
    return (
      <Card title="Backtest summary">
        <div className="text-sm text-[var(--color-muted)] py-3">
          Backtest needs at least 1 closed trade in SECTOR-LEDGER. The bot
          replays each closed trade against the current exit rules and
          shows the P&L delta vs your live fills. Click <strong>Run fresh</strong>{" "}
          once trades have closed.
        </div>
      </Card>
    );
  }

  const deltaPct =
    summary.totalActualPnl !== 0
      ? (summary.pnlDelta / Math.abs(summary.totalActualPnl)) * 100
      : null;
  const deltaPositive = summary.pnlDelta > 0;

  return (
    <div className="space-y-3">
      <section className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Kpi
          label="Trades replayed"
          value={String(summary.tradeCount)}
          hint={`run ${summary.runDate}`}
        />
        <Kpi
          label="Actual P&L"
          value={fmtSignedMoney(summary.totalActualPnl)}
        />
        <Kpi
          label="Sim P&L"
          value={fmtSignedMoney(summary.totalSimPnl)}
        />
        <Kpi
          label="Delta (sim − actual)"
          value={fmtSignedMoney(summary.pnlDelta)}
          delta={
            deltaPct != null
              ? {
                  value: `${deltaPositive ? "+" : ""}${deltaPct.toFixed(1)}%`,
                  positive: deltaPositive,
                }
              : undefined
          }
        />
      </section>
      <Card title="Exit reason breakdown" subtitle={`Run ${summary.runDate}`}>
        <div className="flex flex-wrap gap-2">
          {Object.entries(summary.reasonBreakdown).map(([reason, count]) => (
            <Badge key={reason} tone="neutral">
              <span className="font-mono mr-1">{reason}</span>
              <span className="opacity-70">×{count}</span>
            </Badge>
          ))}
          <Badge tone="up">
            <span>Ladder fired ×{Math.round(summary.ladderFireRate * summary.tradeCount)}</span>
            <span className="opacity-70 ml-1">
              ({(summary.ladderFireRate * 100).toFixed(0)}% rate)
            </span>
          </Badge>
        </div>
      </Card>
    </div>
  );
}
