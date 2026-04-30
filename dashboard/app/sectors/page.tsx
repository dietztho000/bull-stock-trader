import { Card, Badge } from "@/components/ui/Card";
import { SectorBars } from "@/components/charts/SectorBars";
import { loadSectorLedger } from "@/lib/parsers/sectorLedger";
import { bySector } from "@/lib/stats/tradeStats";
import { fmtMoney, fmtPct, fmtSignedMoney } from "@/lib/format";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function SectorsPage() {
  const ledger = await loadSectorLedger();
  const grouped = bySector(ledger.closed);

  const pnlBars = grouped.map((g) => ({
    sector: g.sector,
    value: g.stats.totalPnl,
  }));

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-semibold">Sectors</h1>

      <Card title="Sector streak status" subtitle="Rule #10: 2 consecutive losses → sector blocked for 30 days">
        {ledger.streaks.length === 0 ? (
          <div className="text-sm text-[var(--color-muted)]">
            No sector data yet — fills in once trades close.
          </div>
        ) : (
          <table className="w-full text-sm tabular">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wider text-[var(--color-muted)] border-b border-[var(--color-border)]">
                <th className="py-2 pr-3">Sector</th>
                <th className="py-2 pr-3">Last 2 outcomes</th>
                <th className="py-2 pr-3">30-day streak</th>
                <th className="py-2 pr-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {ledger.streaks.map((s) => (
                <tr key={s.sector} className="border-b border-[var(--color-border)]/40">
                  <td className="py-1.5 pr-3 font-semibold">{s.sector}</td>
                  <td className="py-1.5 pr-3">{s.lastTwo}</td>
                  <td className="py-1.5 pr-3">{s.streak}</td>
                  <td className="py-1.5 pr-3">
                    {s.status === "BLOCKED" ? (
                      <Badge tone="down">BLOCKED</Badge>
                    ) : (
                      <Badge tone="up">{s.status || "OPEN"}</Badge>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Card title="Realized P&L by sector">
        <SectorBars data={pnlBars} format="money" />
      </Card>

      <Card title="Per-sector stats">
        {grouped.length === 0 ? (
          <div className="text-sm text-[var(--color-muted)]">No closed trades yet.</div>
        ) : (
          <table className="w-full text-sm tabular">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wider text-[var(--color-muted)] border-b border-[var(--color-border)]">
                <th className="py-2 pr-3">Sector</th>
                <th className="py-2 pr-3">Trades</th>
                <th className="py-2 pr-3">Win rate</th>
                <th className="py-2 pr-3">P&L</th>
                <th className="py-2 pr-3">Avg win</th>
                <th className="py-2 pr-3">Avg loss</th>
                <th className="py-2 pr-3">Profit factor</th>
                <th className="py-2 pr-3">Expectancy</th>
              </tr>
            </thead>
            <tbody>
              {grouped.map((g) => (
                <tr key={g.sector} className="border-b border-[var(--color-border)]/40">
                  <td className="py-1.5 pr-3 font-semibold">{g.sector}</td>
                  <td className="py-1.5 pr-3">{g.stats.total}</td>
                  <td className="py-1.5 pr-3">{(g.stats.winRate * 100).toFixed(0)}%</td>
                  <td className="py-1.5 pr-3">{fmtSignedMoney(g.stats.totalPnl)}</td>
                  <td className="py-1.5 pr-3">{fmtMoney(g.stats.avgWin)}</td>
                  <td className="py-1.5 pr-3">{fmtMoney(g.stats.avgLoss)}</td>
                  <td className="py-1.5 pr-3">
                    {g.stats.profitFactor != null && Number.isFinite(g.stats.profitFactor)
                      ? g.stats.profitFactor.toFixed(2)
                      : "—"}
                  </td>
                  <td className="py-1.5 pr-3">{fmtSignedMoney(g.stats.expectancy)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
