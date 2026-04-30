import { Card, Kpi } from "@/components/ui/Card";
import { TradesTable } from "@/components/tables/TradesTable";
import { Histogram } from "@/components/charts/Histogram";
import { RScatter } from "@/components/charts/RScatter";
import { loadSectorLedger } from "@/lib/parsers/sectorLedger";
import { loadTradeLog } from "@/lib/parsers/tradeLog";
import { computeTradeStats } from "@/lib/stats/tradeStats";
import { rMultiples, avgR } from "@/lib/stats/rMultiple";
import { fmtMoney, fmtPct, fmtSignedMoney } from "@/lib/format";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function TradesPage() {
  const ledger = await loadSectorLedger();
  const tradeLog = await loadTradeLog();
  const stats = computeTradeStats(ledger.closed);
  const rs = rMultiples(ledger.closed, tradeLog.entries);
  const avg = avgR(rs);

  // hold duration not directly in markdown — derive from entry log if dates
  const scorerScatter = ledger.closed
    .map((t) => {
      const entry = tradeLog.entries.find(
        (e) => e.ticker === t.symbol && e.scorer?.total != null
      );
      if (!entry?.scorer?.total || t.pnlPct == null) return null;
      return { x: entry.scorer.total, y: t.pnlPct, symbol: t.symbol, date: t.date };
    })
    .filter(Boolean) as { x: number; y: number; symbol: string; date: string }[];

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-semibold">Trades</h1>

      <section className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <Kpi label="Closed trades" value={String(stats.total)} hint={`${stats.wins}W / ${stats.losses}L / ${stats.breakeven}B`} />
        <Kpi label="Win rate" value={`${(stats.winRate * 100).toFixed(1)}%`} />
        <Kpi label="Realized P&L" value={fmtSignedMoney(stats.totalPnl)} />
        <Kpi label="Avg R" value={avg != null ? avg.toFixed(2) : "—"} />
        <Kpi label="Profit factor" value={stats.profitFactor != null && Number.isFinite(stats.profitFactor) ? stats.profitFactor.toFixed(2) : "—"} />
      </section>

      <Card title="All closed trades">
        <TradesTable trades={ledger.closed} />
      </Card>

      <div className="grid lg:grid-cols-2 gap-5">
        <Card title="P&L % distribution" subtitle="Realized return per trade">
          <Histogram
            values={ledger.closed.map((t) => t.pnlPct).filter((v): v is number => v != null)}
            format="pct"
          />
        </Card>
        <Card title="R-multiple distribution" subtitle="(exit - entry) / |entry - stop|">
          <Histogram values={rs.map((r) => r.r)} format="number" />
        </Card>
      </div>

      <Card title="Entry scorer vs realized P&L %" subtitle="Did high-conviction entries pay off?">
        <RScatter data={scorerScatter} />
      </Card>

      <Card title="Best and worst">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <div className="text-[var(--color-muted)] text-xs uppercase tracking-wider mb-1">Best trade</div>
            {stats.best ? (
              <div>
                <span className="font-semibold">{stats.best.symbol}</span>{" "}
                <span className="text-[var(--color-up)]">{fmtSignedMoney(stats.best.pnl)}</span>{" "}
                <span className="text-[var(--color-muted)]">{fmtPct(stats.best.pnlPct)} · {stats.best.date}</span>
              </div>
            ) : "—"}
          </div>
          <div>
            <div className="text-[var(--color-muted)] text-xs uppercase tracking-wider mb-1">Worst trade</div>
            {stats.worst ? (
              <div>
                <span className="font-semibold">{stats.worst.symbol}</span>{" "}
                <span className="text-[var(--color-down)]">{fmtSignedMoney(stats.worst.pnl)}</span>{" "}
                <span className="text-[var(--color-muted)]">{fmtPct(stats.worst.pnlPct)} · {stats.worst.date}</span>
              </div>
            ) : "—"}
          </div>
        </div>
      </Card>
    </div>
  );
}
