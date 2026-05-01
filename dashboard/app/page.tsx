import { Card, Kpi } from "@/components/ui/Card";
import { AccountPanel } from "@/components/live/AccountPanel";
import { AccountTabs } from "@/components/live/AccountTabs";
import { MarketClock } from "@/components/live/MarketClock";
import { EquityCurve } from "@/components/charts/EquityCurve";
import { loadBenchmark } from "@/lib/parsers/benchmark";
import { loadResearchLog } from "@/lib/parsers/researchLog";
import { readBotMode } from "@/lib/mode";
import { fmtMoney, fmtPct, fmtSignedMoney, colorOf } from "@/lib/format";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function OverviewPage() {
  const [benchmark, research, defaultTab] = await Promise.all([
    loadBenchmark(),
    loadResearchLog(),
    readBotMode(),
  ]);

  const last = benchmark.rows[benchmark.rows.length - 1] ?? null;
  const phasePnl =
    last?.portfolio != null && benchmark.startingEquity != null
      ? last.portfolio - benchmark.startingEquity
      : null;

  return (
    <div className="space-y-5">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Overview</h1>
          <p className="text-xs text-[var(--color-muted)]">
            Phase started {benchmark.phaseStart ?? "—"} ·{" "}
            {benchmark.startingEquity != null
              ? fmtMoney(benchmark.startingEquity)
              : "—"}{" "}
            starting equity · {benchmark.rows.length} trading days recorded
          </p>
        </div>
        <MarketClock />
      </header>

      <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 gap-3">
        <Kpi
          label="Phase P&L"
          value={fmtSignedMoney(phasePnl)}
          delta={{
            value: fmtPct(last?.phasePct),
            positive: colorOf(last?.phasePct),
          }}
          hint="vs phase start (live)"
        />
      </section>

      <Card title="Equity vs SPY (phase to date)">
        <EquityCurve
          data={benchmark.rows.map((r) => ({
            date: r.date,
            portfolio: r.portfolio,
            spy: r.spyClose,
          }))}
          startingEquity={benchmark.startingEquity}
        />
      </Card>

      <AccountTabs
        defaultTab={defaultTab}
        livePanel={<AccountPanel mode="live" />}
        paperPanel={<AccountPanel mode="paper" />}
      />

      {research[0] && (
        <Card title={`Latest research — ${research[0].date}`}>
          <pre className="whitespace-pre-wrap text-xs leading-relaxed text-[var(--color-text)]">
            {research[0].body}
          </pre>
        </Card>
      )}
    </div>
  );
}
