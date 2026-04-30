import { Card, Kpi } from "@/components/ui/Card";
import { Histogram } from "@/components/charts/Histogram";
import { loadBenchmark } from "@/lib/parsers/benchmark";
import { loadSectorLedger } from "@/lib/parsers/sectorLedger";
import { loadTradeLog } from "@/lib/parsers/tradeLog";
import { dailyReturns, mean, std } from "@/lib/stats/returns";
import { drawdownSeries, maxDrawdown } from "@/lib/stats/drawdown";
import { sharpe, sortino, calmar, annualizedReturn } from "@/lib/stats/sharpe";
import { computeTradeStats } from "@/lib/stats/tradeStats";
import { rMultiples, avgR } from "@/lib/stats/rMultiple";
import { bestWorst, monthlyAggregates } from "@/lib/stats/streaks";
import { fmtMoney, fmtPct, fmtPctFraction, fmtSignedMoney } from "@/lib/format";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function fmt(n: number | null | undefined, digits = 2) {
  return n != null && Number.isFinite(n) ? n.toFixed(digits) : "—";
}

export default async function StatsPage() {
  const benchmark = await loadBenchmark();
  const ledger = await loadSectorLedger();
  const tradeLog = await loadTradeLog();

  const rets = dailyReturns(benchmark.rows, benchmark.startingEquity);
  const dd = drawdownSeries(benchmark.rows);
  const maxDd = maxDrawdown(dd);
  const sr = sharpe(rets);
  const so = sortino(rets);
  const ar = annualizedReturn(rets);
  const ca = calmar(ar, maxDd.pct);

  const stats = computeTradeStats(ledger.closed);
  const rs = rMultiples(ledger.closed, tradeLog.entries);
  const avgRm = avgR(rs);

  const dailyMean = mean(rets.map((r) => r.ret));
  const dailyStd = std(rets.map((r) => r.ret));

  const { best: bestDay, worst: worstDay } = bestWorst(rets);
  const monthly = monthlyAggregates(rets);
  const bestMonth = monthly.reduce<{ ym: string; ret: number } | null>(
    (a, b) => (a == null || b.ret > a.ret ? b : a),
    null
  );
  const worstMonth = monthly.reduce<{ ym: string; ret: number } | null>(
    (a, b) => (a == null || b.ret < a.ret ? b : a),
    null
  );

  // Stop discipline: among losses, what fraction are at -7% +/- 0.5%
  const stopDiscipline = (() => {
    const losses = ledger.closed.filter((t) => t.outcome === "L" && t.pnlPct != null);
    if (!losses.length) return null;
    const ruleHit = losses.filter((t) => Math.abs((t.pnlPct ?? 0) - -7) <= 0.5).length;
    return ruleHit / losses.length;
  })();

  // Win rate by entry-scorer bucket (7/8/9/10)
  const scorerBuckets = (() => {
    const buckets: Record<number, { wins: number; total: number }> = {};
    for (const t of ledger.closed) {
      const e = tradeLog.entries.find((x) => x.ticker === t.symbol);
      const total = e?.scorer?.total;
      if (total == null) continue;
      buckets[total] = buckets[total] ?? { wins: 0, total: 0 };
      buckets[total].total += 1;
      if (t.outcome === "W") buckets[total].wins += 1;
    }
    return Object.entries(buckets)
      .map(([k, v]) => ({ score: Number(k), winRate: v.wins / v.total, n: v.total }))
      .sort((a, b) => a.score - b.score);
  })();

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-semibold">Stat nerd page</h1>

      <section>
        <h2 className="text-sm uppercase tracking-wider text-[var(--color-muted)] mb-2">Risk-adjusted</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Kpi label="Sharpe (annualized)" value={fmt(sr)} hint="rf=0, 252 days" />
          <Kpi label="Sortino" value={fmt(so)} hint="downside-only" />
          <Kpi label="Calmar" value={fmt(ca)} hint="ann. return / |max DD|" />
          <Kpi label="Annualized return" value={fmtPctFraction(ar)} />
        </div>
      </section>

      <section>
        <h2 className="text-sm uppercase tracking-wider text-[var(--color-muted)] mb-2">Drawdown</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Kpi label="Max drawdown" value={fmtPctFraction(maxDd.pct)} hint={fmtMoney(maxDd.dollar)} />
          <Kpi label="Peak date" value={maxDd.peakDate ?? "—"} />
          <Kpi label="Trough date" value={maxDd.troughDate ?? "—"} />
          <Kpi label="Recovery" value={maxDd.recoveryDate ?? "underwater"} hint={maxDd.durationDays != null ? `${maxDd.durationDays}d to trough` : ""} />
        </div>
      </section>

      <section>
        <h2 className="text-sm uppercase tracking-wider text-[var(--color-muted)] mb-2">Daily returns</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Kpi label="Mean (daily)" value={fmtPctFraction(dailyMean, 3)} />
          <Kpi label="Std dev (daily)" value={fmtPctFraction(dailyStd, 3)} />
          <Kpi
            label="Best day"
            value={bestDay ? fmtPctFraction(bestDay.ret) : "—"}
            hint={bestDay?.date}
          />
          <Kpi
            label="Worst day"
            value={worstDay ? fmtPctFraction(worstDay.ret) : "—"}
            hint={worstDay?.date}
          />
        </div>
      </section>

      <section>
        <h2 className="text-sm uppercase tracking-wider text-[var(--color-muted)] mb-2">Trades</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Kpi label="Closed" value={String(stats.total)} hint={`${stats.wins}W / ${stats.losses}L / ${stats.breakeven}B`} />
          <Kpi label="Win rate" value={`${(stats.winRate * 100).toFixed(1)}%`} />
          <Kpi label="Profit factor" value={stats.profitFactor != null && Number.isFinite(stats.profitFactor) ? stats.profitFactor.toFixed(2) : "—"} />
          <Kpi label="Payoff ratio" value={fmt(stats.payoffRatio)} hint="avg win / avg loss" />
          <Kpi label="Avg win" value={fmtMoney(stats.avgWin)} />
          <Kpi label="Avg loss" value={fmtMoney(stats.avgLoss)} />
          <Kpi label="Expectancy" value={fmtSignedMoney(stats.expectancy)} hint="$ / trade" />
          <Kpi label="Avg R-multiple" value={fmt(avgRm)} />
          <Kpi label="Longest win streak" value={String(stats.longestWinStreak)} />
          <Kpi label="Longest loss streak" value={String(stats.longestLossStreak)} />
          <Kpi label="Best trade" value={stats.best ? fmtSignedMoney(stats.best.pnl) : "—"} hint={stats.best?.symbol} />
          <Kpi label="Worst trade" value={stats.worst ? fmtSignedMoney(stats.worst.pnl) : "—"} hint={stats.worst?.symbol} />
        </div>
      </section>

      <section>
        <h2 className="text-sm uppercase tracking-wider text-[var(--color-muted)] mb-2">Discipline</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Kpi
            label="Stop discipline"
            value={stopDiscipline != null ? `${(stopDiscipline * 100).toFixed(0)}%` : "—"}
            hint="losses cut at -7% rule"
          />
          <Kpi label="Trades per week" value={(() => {
            if (!ledger.closed.length) return "—";
            const days = Math.max(1, (new Date().getTime() - new Date(ledger.closed[0].date).getTime()) / (7 * 86400000));
            return (ledger.closed.length / days).toFixed(2);
          })()} hint="cap 3" />
          <Kpi label="Best month" value={bestMonth ? fmtPctFraction(bestMonth.ret) : "—"} hint={bestMonth?.ym} />
          <Kpi label="Worst month" value={worstMonth ? fmtPctFraction(worstMonth.ret) : "—"} hint={worstMonth?.ym} />
        </div>
      </section>

      <div className="grid lg:grid-cols-2 gap-5">
        <Card title="R-multiple distribution">
          <Histogram values={rs.map((r) => r.r)} format="number" />
        </Card>
        <Card title="Daily returns distribution">
          <Histogram values={rets.map((r) => r.ret * 100)} format="pct" />
        </Card>
      </div>

      {scorerBuckets.length > 0 && (
        <Card title="Win rate by entry-scorer bucket">
          <table className="text-sm tabular w-full">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wider text-[var(--color-muted)] border-b border-[var(--color-border)]">
                <th className="py-2 pr-3">Score</th>
                <th className="py-2 pr-3">Trades</th>
                <th className="py-2 pr-3">Win rate</th>
              </tr>
            </thead>
            <tbody>
              {scorerBuckets.map((b) => (
                <tr key={b.score} className="border-b border-[var(--color-border)]/40">
                  <td className="py-1.5 pr-3 font-semibold">{b.score}/10</td>
                  <td className="py-1.5 pr-3">{b.n}</td>
                  <td className="py-1.5 pr-3">{(b.winRate * 100).toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
