import { Card, Kpi } from "@/components/ui/Card";
import { EquityCurve } from "@/components/charts/EquityCurve";
import { DrawdownChart } from "@/components/charts/DrawdownChart";
import { Histogram } from "@/components/charts/Histogram";
import { AlphaChart } from "@/components/charts/AlphaChart";
import { CalendarHeatmap } from "@/components/charts/CalendarHeatmap";
import { loadBenchmark } from "@/lib/parsers/benchmark";
import { dailyReturns } from "@/lib/stats/returns";
import { drawdownSeries, maxDrawdown } from "@/lib/stats/drawdown";
import { fmtPctFraction, fmtMoney } from "@/lib/format";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function PerformancePage() {
  const benchmark = await loadBenchmark();
  const rets = dailyReturns(benchmark.rows, benchmark.startingEquity);
  const dd = drawdownSeries(benchmark.rows);
  const maxDd = maxDrawdown(dd);

  let cum = 0;
  const alphaSeries = rets
    .filter((r) => r.alpha != null)
    .map((r) => {
      cum += r.alpha!;
      return { date: r.date, alpha: r.alpha!, cumAlpha: cum };
    });

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-semibold">Performance</h1>

      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi
          label="Days recorded"
          value={String(benchmark.rows.length)}
        />
        <Kpi label="Max drawdown" value={fmtPctFraction(maxDd.pct)} hint={fmtMoney(maxDd.dollar)} />
        <Kpi
          label="DD trough"
          value={maxDd.troughDate ?? "—"}
          hint={maxDd.peakDate ? `from ${maxDd.peakDate}` : ""}
        />
        <Kpi
          label="Recovery"
          value={maxDd.recoveryDate ?? "underwater"}
        />
      </section>

      <Card title="Equity curve" subtitle="Portfolio vs SPY (SPY normalized to starting equity)">
        <EquityCurve
          data={benchmark.rows.map((r) => ({
            date: r.date,
            portfolio: r.portfolio,
            spy: r.spyClose,
          }))}
          startingEquity={benchmark.startingEquity}
          height={340}
        />
      </Card>

      <Card title="Drawdown" subtitle="Underwater equity curve from running peak">
        <DrawdownChart data={dd.map((d) => ({ date: d.date, ddPct: d.ddPct }))} />
      </Card>

      <Card title="Alpha" subtitle="Daily portfolio - SPY return; cumulative on right axis">
        <AlphaChart data={alphaSeries} />
      </Card>

      <div className="grid lg:grid-cols-2 gap-5">
        <Card title="Daily return distribution">
          <Histogram values={rets.map((r) => r.ret * 100)} format="pct" />
        </Card>
        <Card title="Daily P&L calendar">
          <CalendarHeatmap data={rets.map((r) => ({ date: r.date, ret: r.ret }))} />
        </Card>
      </div>
    </div>
  );
}
