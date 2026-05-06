import { Card, Kpi } from "@/components/ui/Card";
import { UrlTabs } from "@/components/ui/UrlTabs";
import { activeTab } from "@/lib/activeTab";
import { LiveEquityOverlayTile } from "@/components/live/tiles/LiveEquityOverlayTile";
import { EquityCurve } from "@/components/charts/EquityCurve";
import { DrawdownChart } from "@/components/charts/DrawdownChart";
import { Histogram } from "@/components/charts/Histogram";
import { AlphaChart } from "@/components/charts/AlphaChart";
import { CalendarHeatmap } from "@/components/charts/CalendarHeatmap";
import {
  BacktestEmptyCard,
  BacktestReasonBreakdown,
  buildBacktestKpiTiles,
} from "@/components/backtest/BacktestSummary";
import { BacktestTable } from "@/components/backtest/BacktestTable";
import { BacktestCurve } from "@/components/backtest/BacktestCurve";
import { RunFreshButton } from "@/components/backtest/RunFreshButton";
import { CrossBotBacktestPanel } from "@/components/backtest/CrossBotBacktestPanel";
import { BacktestSnapshotCompare } from "@/components/backtest/BacktestSnapshotCompare";
import { DashboardGrid } from "@/components/layout/DashboardGrid";
import { LayoutProvider } from "@/components/layout/LayoutEditContext";
import { EditLayoutToggle } from "@/components/layout/EditLayoutToggle";
import {
  ANALYTICS_BACKTEST_LAYOUT,
  ANALYTICS_CURVE_LAYOUT,
  ANALYTICS_RISK_LAYOUT,
} from "@/components/layout/defaults";
import { loadBenchmark } from "@/lib/parsers/benchmark";
import { loadSectorLedger } from "@/lib/parsers/sectorLedger";
import { loadTradeLog } from "@/lib/parsers/tradeLog";
import { dailyReturns, mean, std } from "@/lib/stats/returns";
import { drawdownSeries, maxDrawdown } from "@/lib/stats/drawdown";
import { sharpe, sortino, calmar, annualizedReturn } from "@/lib/stats/sharpe";
import { computeTradeStats } from "@/lib/stats/tradeStats";
import { rMultiples, avgR } from "@/lib/stats/rMultiple";
import { todayInCT, daysBetweenISO } from "@/lib/time";
import { bestWorst, monthlyAggregates } from "@/lib/stats/streaks";
import { readBacktestSnapshot } from "@/lib/backtest/cache";
import type { Trade } from "@/lib/backtest/types";
import {
  fmtMoney,
  fmtPctFraction,
  fmtSignedMoney,
} from "@/lib/format";
import { resolveBotCtx } from "@/lib/resolveAccount";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const TABS = ["curve", "risk", "backtest"] as const;
type Tab = (typeof TABS)[number];

const TAB_OPTIONS: { value: Tab; label: string }[] = [
  { value: "curve", label: "Curve" },
  { value: "risk", label: "Risk" },
  { value: "backtest", label: "Backtest" },
];

function fmt(n: number | null | undefined, digits = 2) {
  return n != null && Number.isFinite(n) ? n.toFixed(digits) : "—";
}

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const sp = await searchParams;
  const tab = activeTab<Tab>(sp, "tab", TABS, "curve");
  const { botId, strategy } = await resolveBotCtx(sp);

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Analytics</h1>
          <p className="text-xs text-[var(--color-muted)] mt-0.5">
            Equity curve, risk-adjusted metrics, and rule-change backtest replay.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <UrlTabs<Tab>
            layoutId="analytics-tabs"
            options={TAB_OPTIONS}
            fallback="curve"
          />
        </div>
      </header>

      {tab === "curve" && <CurveTab botId={botId} strategy={strategy} />}
      {tab === "risk" && <RiskTab botId={botId} strategy={strategy} />}
      {tab === "backtest" && <BacktestTab botId={botId} strategy={strategy} />}
    </div>
  );
}

async function CurveTab({ botId, strategy }: { botId: string; strategy: string }) {
  const benchmark = await loadBenchmark({ bot: botId, strategy });
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

  const tiles = {
    "live-snapshot": <LiveEquityOverlayTile />,
    "kpi-days": <Kpi label="Days recorded" value={String(benchmark.rows.length)} />,
    "kpi-max-dd": (
      <Kpi
        label="Max drawdown"
        value={fmtPctFraction(maxDd.pct)}
        hint={fmtMoney(maxDd.dollar)}
      />
    ),
    "kpi-dd-trough": (
      <Kpi
        label="DD trough"
        value={maxDd.troughDate ?? "—"}
        hint={maxDd.peakDate ? `from ${maxDd.peakDate}` : ""}
      />
    ),
    "kpi-recovery": (
      <Kpi label="Recovery" value={maxDd.recoveryDate ?? "underwater"} />
    ),
    "equity-curve": (
      <Card
        title="Equity curve"
        subtitle="Portfolio vs SPY (SPY normalized to starting equity)"
      >
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
    ),
    drawdown: (
      <Card title="Drawdown" subtitle="Underwater equity curve from running peak">
        <DrawdownChart data={dd.map((d) => ({ date: d.date, ddPct: d.ddPct }))} />
      </Card>
    ),
    alpha: (
      <Card title="Alpha" subtitle="Daily portfolio − SPY return; cumulative on right axis">
        <AlphaChart data={alphaSeries} />
      </Card>
    ),
    "daily-return-dist": (
      <Card title="Daily return distribution">
        <Histogram values={rets.map((r) => r.ret * 100)} format="pct" />
      </Card>
    ),
    "calendar-heatmap": (
      <Card title="Daily P&L calendar">
        <CalendarHeatmap data={rets.map((r) => ({ date: r.date, ret: r.ret }))} />
      </Card>
    ),
  };

  return (
    <LayoutProvider pageId="analytics:curve" spec={ANALYTICS_CURVE_LAYOUT}>
      <div className="flex justify-end -mt-2 mb-1">
        <EditLayoutToggle />
      </div>
      <DashboardGrid tiles={tiles} />
    </LayoutProvider>
  );
}

async function RiskTab({ botId, strategy }: { botId: string; strategy: string }) {
  const ctx = { bot: botId, strategy };
  const benchmark = await loadBenchmark(ctx);
  const ledger = await loadSectorLedger(ctx);
  const tradeLog = await loadTradeLog(ctx);

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

  const stopDiscipline = (() => {
    const losses = ledger.closed.filter(
      (t) => t.outcome === "L" && t.pnlPct != null
    );
    if (!losses.length) return null;
    const ruleHit = losses.filter(
      (t) => Math.abs((t.pnlPct ?? 0) - -7) <= 0.5
    ).length;
    return ruleHit / losses.length;
  })();

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

  const tradesPerWeek = (() => {
    if (!ledger.closed.length) return "—";
    const weeks = Math.max(
      1,
      daysBetweenISO(ledger.closed[0].date, todayInCT()) / 7
    );
    return (ledger.closed.length / weeks).toFixed(2);
  })();

  const tiles: Record<string, React.ReactNode> = {
    "kpi-sharpe": <Kpi label="Sharpe (annualized)" value={fmt(sr)} hint="rf=0, 252 days" />,
    "kpi-sortino": <Kpi label="Sortino" value={fmt(so)} hint="downside-only" />,
    "kpi-calmar": <Kpi label="Calmar" value={fmt(ca)} hint="ann. return / |max DD|" />,
    "kpi-ann-return": <Kpi label="Annualized return" value={fmtPctFraction(ar)} />,
    "kpi-max-dd": (
      <Kpi
        label="Max drawdown"
        value={fmtPctFraction(maxDd.pct)}
        hint={fmtMoney(maxDd.dollar)}
      />
    ),
    "kpi-peak-date": <Kpi label="Peak date" value={maxDd.peakDate ?? "—"} />,
    "kpi-trough-date": <Kpi label="Trough date" value={maxDd.troughDate ?? "—"} />,
    "kpi-recovery": (
      <Kpi
        label="Recovery"
        value={maxDd.recoveryDate ?? "underwater"}
        hint={maxDd.durationDays != null ? `${maxDd.durationDays}d to trough` : ""}
      />
    ),
    "kpi-mean": <Kpi label="Mean (daily)" value={fmtPctFraction(dailyMean, 3)} />,
    "kpi-stddev": <Kpi label="Std dev (daily)" value={fmtPctFraction(dailyStd, 3)} />,
    "kpi-best-day": (
      <Kpi
        label="Best day"
        value={bestDay ? fmtPctFraction(bestDay.ret) : "—"}
        hint={bestDay?.date}
      />
    ),
    "kpi-worst-day": (
      <Kpi
        label="Worst day"
        value={worstDay ? fmtPctFraction(worstDay.ret) : "—"}
        hint={worstDay?.date}
      />
    ),
    "kpi-closed": (
      <Kpi
        label="Closed"
        value={String(stats.total)}
        hint={`${stats.wins}W / ${stats.losses}L / ${stats.breakeven}B`}
      />
    ),
    "kpi-winrate": <Kpi label="Win rate" value={`${(stats.winRate * 100).toFixed(1)}%`} />,
    "kpi-profit-factor": (
      <Kpi
        label="Profit factor"
        value={
          stats.profitFactor != null && Number.isFinite(stats.profitFactor)
            ? stats.profitFactor.toFixed(2)
            : "—"
        }
      />
    ),
    "kpi-payoff": (
      <Kpi label="Payoff ratio" value={fmt(stats.payoffRatio)} hint="avg win / avg loss" />
    ),
    "kpi-avg-win": <Kpi label="Avg win" value={fmtMoney(stats.avgWin)} />,
    "kpi-avg-loss": <Kpi label="Avg loss" value={fmtMoney(stats.avgLoss)} />,
    "kpi-expectancy": (
      <Kpi label="Expectancy" value={fmtSignedMoney(stats.expectancy)} hint="$ / trade" />
    ),
    "kpi-avg-r": <Kpi label="Avg R-multiple" value={fmt(avgRm)} />,
    "kpi-stop-discipline": (
      <Kpi
        label="Stop discipline"
        value={stopDiscipline != null ? `${(stopDiscipline * 100).toFixed(0)}%` : "—"}
        hint="losses cut at -7% rule"
      />
    ),
    "kpi-trades-per-week": (
      <Kpi label="Trades per week" value={tradesPerWeek} hint="cap 3" />
    ),
    "kpi-best-month": (
      <Kpi
        label="Best month"
        value={bestMonth ? fmtPctFraction(bestMonth.ret) : "—"}
        hint={bestMonth?.ym}
      />
    ),
    "kpi-worst-month": (
      <Kpi
        label="Worst month"
        value={worstMonth ? fmtPctFraction(worstMonth.ret) : "—"}
        hint={worstMonth?.ym}
      />
    ),
    "kpi-longest-win-streak": (
      <Kpi label="Longest win streak" value={String(stats.longestWinStreak)} />
    ),
    "kpi-longest-loss-streak": (
      <Kpi label="Longest loss streak" value={String(stats.longestLossStreak)} />
    ),
    "kpi-best-trade": (
      <Kpi
        label="Best trade"
        value={stats.best ? fmtSignedMoney(stats.best.pnl) : "—"}
        hint={stats.best?.symbol}
      />
    ),
    "kpi-worst-trade": (
      <Kpi
        label="Worst trade"
        value={stats.worst ? fmtSignedMoney(stats.worst.pnl) : "—"}
        hint={stats.worst?.symbol}
      />
    ),
    "r-distribution": (
      <Card title="R-multiple distribution">
        <Histogram values={rs.map((r) => r.r)} format="number" />
      </Card>
    ),
    "daily-distribution": (
      <Card title="Daily returns distribution">
        <Histogram values={rets.map((r) => r.ret * 100)} format="pct" />
      </Card>
    ),
    "scorer-table":
      scorerBuckets.length > 0 ? (
        <Card title="Win rate by entry-scorer bucket">
          <table className="text-sm tabular w-full">
            <thead>
              <tr className="text-left text-[10px] uppercase tracking-[0.14em] text-[var(--color-muted)] border-b border-[rgba(255,255,255,0.08)]">
                <th className="py-2 pr-3">Score</th>
                <th className="py-2 pr-3">Trades</th>
                <th className="py-2 pr-3">Win rate</th>
              </tr>
            </thead>
            <tbody>
              {scorerBuckets.map((b) => (
                <tr key={b.score} className="border-b border-[rgba(255,255,255,0.04)]">
                  <td className="py-1.5 pr-3 font-semibold">{b.score}/10</td>
                  <td className="py-1.5 pr-3">{b.n}</td>
                  <td className="py-1.5 pr-3">{(b.winRate * 100).toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      ) : null,
  };

  return (
    <LayoutProvider pageId="analytics:risk" spec={ANALYTICS_RISK_LAYOUT}>
      <div className="flex justify-end -mt-2 mb-1">
        <EditLayoutToggle />
      </div>
      <DashboardGrid tiles={tiles} />
    </LayoutProvider>
  );
}

async function BacktestTab({ botId, strategy }: { botId: string; strategy: string }) {
  // Read cached snapshot only — never auto-run the backtest engine on page
  // load (it's a multi-second Alpaca-bound operation per closed trade).
  // Users explicitly trigger fresh runs via the RunFreshButton.
  const ctx = { bot: botId, strategy };
  const [ledger, tradeLog, snapshot] = await Promise.all([
    loadSectorLedger(ctx),
    loadTradeLog(ctx),
    readBacktestSnapshot(ctx),
  ]);

  const summary = snapshot?.summary ?? null;
  const results = snapshot?.results ?? [];

  const rows = results
    .map((r) => {
      const closed = ledger.closed.find(
        (c) => c.symbol === r.symbol && c.date === r.entryDate
      );
      if (
        !closed ||
        closed.entry == null ||
        closed.exit == null ||
        closed.pnl == null
      ) {
        return null;
      }
      const entry = tradeLog.entries.find(
        (e) => e.ticker === r.symbol && e.date === r.entryDate
      );
      const trade: Trade = {
        symbol: closed.symbol,
        sector: closed.sector,
        entryDate: r.entryDate,
        entryPrice: closed.entry,
        shares: entry?.shares ?? r.shares,
        actualExitDate: closed.date,
        actualExitPrice: closed.exit,
        actualPnl: closed.pnl,
        actualPnlPct: closed.pnlPct ?? 0,
        outcome:
          closed.outcome === "W" || closed.outcome === "L" || closed.outcome === "B"
            ? closed.outcome
            : "B",
      };
      return { result: r, trade };
    })
    .filter(
      (x): x is { result: (typeof results)[number]; trade: Trade } => x !== null
    );

  const provenance = summary && (summary.tradeSourceBot || summary.strategySourceBot)
    ? `trades: ${summary.tradeSourceBot ?? "—"} · strategy: ${summary.strategySourceBot ?? "default"}`
    : null;

  const headerTile = (
    <div className="flex items-center justify-between gap-3 frost rounded-2xl p-4">
      <p className="text-xs text-[var(--color-muted)] max-w-2xl">
        Live-trade replay. Each closed trade is rerun against the current exit
        rules; the delta tells you how a rule change would have changed P&L.
        Runs in paper mode against Alpaca historical bars.{" "}
        {snapshot ? (
          <span className="text-[var(--color-muted)]">
            Showing cached results from {summary?.runDate}.
            {provenance && <> · {provenance}</>}
          </span>
        ) : (
          <span className="text-[var(--color-warn)]">
            No cached results yet — click Run fresh to seed.
          </span>
        )}
      </p>
      <RunFreshButton accountParam={botId} />
    </div>
  );

  const tiles: Record<string, React.ReactNode> =
    summary && summary.tradeCount > 0
      ? {
          header: headerTile,
          ...buildBacktestKpiTiles(summary),
          "reason-breakdown": <BacktestReasonBreakdown summary={summary} />,
          cumulative: (
            <Card title="Cumulative P&L: actual vs simulated">
              <BacktestCurve
                actual={summary.cumulativeActual}
                sim={summary.cumulativeSim}
              />
            </Card>
          ),
          "per-trade": (
            <Card title="Per-trade comparison">
              <BacktestTable rows={rows} />
            </Card>
          ),
        }
      : {
          header: headerTile,
          summary: <BacktestEmptyCard />,
        };

  return (
    <LayoutProvider pageId="analytics:backtest" spec={ANALYTICS_BACKTEST_LAYOUT}>
      <div className="flex justify-end -mt-2 mb-1">
        <EditLayoutToggle />
      </div>
      <DashboardGrid tiles={tiles} />
      <div className="mt-4">
        <CrossBotBacktestPanel defaultBotId={botId} />
      </div>
      <div className="mt-4">
        <BacktestSnapshotCompare botId={botId} />
      </div>
    </LayoutProvider>
  );
}
