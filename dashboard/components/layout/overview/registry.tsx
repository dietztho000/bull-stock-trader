import { Suspense, type ReactNode } from "react";
import Link from "next/link";
import type {
  Breakpoint,
  LayoutItem,
  ResponsiveLayouts,
} from "react-grid-layout/legacy";

import { Card } from "@/components/ui/Card";
import { PnlHero } from "@/components/live/PnlHero";
import { DrawdownNarrator } from "@/components/ai/DrawdownNarrator";
import { EquityCurve } from "@/components/charts/EquityCurve";
import { UpcomingEventsCard } from "@/components/calendar/UpcomingEventsCard";
import { AccountIdentityTile } from "@/components/live/tiles/AccountIdentityTile";
import { EquityKpiTile } from "@/components/live/tiles/EquityKpiTile";
import { CashKpiTile } from "@/components/live/tiles/CashKpiTile";
import { DeployedKpiTile } from "@/components/live/tiles/DeployedKpiTile";
import { BuyingPowerKpiTile } from "@/components/live/tiles/BuyingPowerKpiTile";
import { DayTradesKpiTile } from "@/components/live/tiles/DayTradesKpiTile";
import { PositionsTile } from "@/components/live/tiles/PositionsTile";
import { OrdersTile } from "@/components/live/tiles/OrdersTile";

import type { PageLayoutSpec } from "@/components/layout/defaults";
import type { AlpacaMode } from "@/lib/alpacaMode";
import type { BenchmarkData } from "@/lib/parsers/benchmark";
import type { EarningsEntry } from "@/lib/parsers/earningsCalendar";
import type { LadderState } from "@/lib/parsers/ladderProgress";
import type { ResearchEntry } from "@/lib/parsers/researchLog";
import type { EconomicEvent } from "@/lib/parsers/economicCalendar";

export type OverviewCtx = {
  accountMode: AlpacaMode;
  benchmark: BenchmarkData;
  yesterdayPortfolio: number | null;
  weekStartPortfolio: number | null;
  spyPhasePct: number | null;
  earnings?: Record<string, EarningsEntry>;
  overnightGaps?: Record<string, number | null>;
  ladder?: Record<string, LadderState>;
  upcomingEarnings: EarningsEntry[];
  economic: EconomicEvent[];
  latestBrief: ResearchEntry | null;
};

export type OverviewTileDef = {
  id: string;
  title: string;
  defaultLayout: {
    x: number;
    y: number;
    w: number;
    h: number;
    minW: number;
    minH: number;
  };
  render: (ctx: OverviewCtx) => ReactNode;
};

export const OVERVIEW_TILES: OverviewTileDef[] = [
  {
    id: "account-identity",
    title: "Account",
    defaultLayout: { x: 0, y: 0, w: 4, h: 4, minW: 3, minH: 3 },
    render: (ctx) => (
      <Suspense fallback={<div className="frost rounded-2xl h-32 animate-pulse" />}>
        <AccountIdentityTile mode={ctx.accountMode} />
      </Suspense>
    ),
  },
  {
    id: "pnl-hero",
    title: "P&L hero",
    defaultLayout: { x: 4, y: 0, w: 8, h: 4, minW: 4, minH: 3 },
    render: (ctx) => (
      <PnlHero
        mode={ctx.accountMode}
        startingEquity={ctx.benchmark.startingEquity}
        phaseStart={ctx.benchmark.phaseStart}
        yesterdayPortfolio={ctx.yesterdayPortfolio}
        weekStartPortfolio={ctx.weekStartPortfolio}
        spyPhasePct={ctx.spyPhasePct}
      />
    ),
  },
  {
    id: "equity-kpi",
    title: "Equity",
    defaultLayout: { x: 0, y: 4, w: 3, h: 3, minW: 2, minH: 2 },
    render: (ctx) => <EquityKpiTile mode={ctx.accountMode} />,
  },
  {
    id: "cash-kpi",
    title: "Cash",
    defaultLayout: { x: 3, y: 4, w: 3, h: 3, minW: 2, minH: 2 },
    render: (ctx) => <CashKpiTile mode={ctx.accountMode} />,
  },
  {
    id: "deployed-kpi",
    title: "Deployed",
    defaultLayout: { x: 6, y: 4, w: 3, h: 3, minW: 2, minH: 2 },
    render: (ctx) => <DeployedKpiTile mode={ctx.accountMode} />,
  },
  {
    id: "buying-power-kpi",
    title: "Buying power",
    defaultLayout: { x: 9, y: 4, w: 3, h: 3, minW: 2, minH: 2 },
    render: (ctx) => <BuyingPowerKpiTile mode={ctx.accountMode} />,
  },
  {
    id: "day-trades-kpi",
    title: "Day trades",
    defaultLayout: { x: 0, y: 7, w: 3, h: 3, minW: 2, minH: 2 },
    render: (ctx) => <DayTradesKpiTile mode={ctx.accountMode} />,
  },
  {
    id: "drawdown-narrator",
    title: "Drawdown narrator",
    defaultLayout: { x: 3, y: 7, w: 9, h: 3, minW: 4, minH: 2 },
    render: () => (
      <Suspense
        fallback={
          <Card title="Drawdown context (AI)">
            <div className="space-y-2 animate-pulse">
              <div className="h-3 w-3/4 rounded bg-[rgba(255,255,255,0.06)]" />
              <div className="h-3 w-5/6 rounded bg-[rgba(255,255,255,0.06)]" />
              <div className="h-3 w-2/3 rounded bg-[rgba(255,255,255,0.06)]" />
              <div className="mt-2 h-2 w-32 rounded bg-[rgba(255,255,255,0.04)]" />
            </div>
          </Card>
        }
      >
        <DrawdownNarrator />
      </Suspense>
    ),
  },
  {
    id: "equity-curve",
    title: "Equity vs SPY",
    defaultLayout: { x: 0, y: 10, w: 8, h: 8, minW: 4, minH: 5 },
    render: (ctx) => (
      <Card
        title="Equity vs SPY"
        subtitle={`Phase to date · ${ctx.benchmark.rows.length} trading days recorded`}
      >
        <EquityCurve
          data={ctx.benchmark.rows.map((r) => ({
            date: r.date,
            portfolio: r.portfolio,
            spy: r.spyClose,
          }))}
          startingEquity={ctx.benchmark.startingEquity}
        />
      </Card>
    ),
  },
  {
    id: "positions",
    title: "Positions",
    defaultLayout: { x: 8, y: 10, w: 4, h: 8, minW: 3, minH: 5 },
    render: (ctx) => (
      <PositionsTile
        mode={ctx.accountMode}
        earnings={ctx.earnings}
        overnightGaps={ctx.overnightGaps}
        ladder={ctx.ladder}
      />
    ),
  },
  {
    id: "orders",
    title: "Open orders",
    defaultLayout: { x: 0, y: 18, w: 12, h: 5, minW: 4, minH: 4 },
    render: (ctx) => <OrdersTile mode={ctx.accountMode} />,
  },
  {
    id: "upcoming-events",
    title: "Upcoming events",
    defaultLayout: { x: 0, y: 23, w: 7, h: 8, minW: 3, minH: 4 },
    render: (ctx) => (
      <UpcomingEventsCard earnings={ctx.upcomingEarnings} economic={ctx.economic} />
    ),
  },
  {
    id: "latest-brief",
    title: "Latest brief",
    defaultLayout: { x: 7, y: 23, w: 5, h: 8, minW: 3, minH: 4 },
    render: (ctx) => <LatestBriefSection latest={ctx.latestBrief} />,
  },
];

function LatestBriefSection({ latest }: { latest: ResearchEntry | null }) {
  if (!latest) {
    return (
      <Card title="No research yet">
        <div className="text-xs text-[var(--color-muted)]">
          Pre-market research lands at 6 AM ET.
        </div>
      </Card>
    );
  }
  return (
    <Card
      title={`Latest brief — ${latest.date}`}
      right={
        <Link
          href="/journal"
          className="text-[11px] text-[var(--color-muted)] hover:text-[var(--color-accent)]"
        >
          Open journal →
        </Link>
      }
    >
      {latest.ideas.length > 0 ? (
        <ul className="text-sm space-y-1.5">
          {latest.ideas.slice(0, 4).map((idea, i) => (
            <li
              key={i}
              className="text-[var(--color-text)] truncate"
              title={idea}
            >
              <span className="text-[var(--color-muted)] mr-2">·</span>
              {idea}
            </li>
          ))}
          {latest.ideas.length > 4 && (
            <li className="text-xs text-[var(--color-muted)] pt-1">
              + {latest.ideas.length - 4} more in journal
            </li>
          )}
        </ul>
      ) : (
        <pre className="whitespace-pre-wrap text-xs leading-relaxed text-[var(--color-text)] max-h-48 overflow-hidden">
          {latest.body}
        </pre>
      )}
    </Card>
  );
}

// Helper: build single-column stacked layout for narrow breakpoints.
function stackTiles(tiles: OverviewTileDef[], cols: number): LayoutItem[] {
  let y = 0;
  return tiles.map((t) => {
    const item: LayoutItem = {
      i: t.id,
      x: 0,
      y,
      w: cols,
      h: t.defaultLayout.h,
      minW: 1,
      minH: t.defaultLayout.minH,
    };
    y += t.defaultLayout.h;
    return item;
  });
}

export const OVERVIEW_LAYOUT: PageLayoutSpec = buildOverviewLayout(OVERVIEW_TILES);

export function buildOverviewLayout(tiles: OverviewTileDef[]): PageLayoutSpec {
  const explicit: LayoutItem[] = tiles.map((t) => ({
    i: t.id,
    x: t.defaultLayout.x,
    y: t.defaultLayout.y,
    w: t.defaultLayout.w,
    h: t.defaultLayout.h,
    minW: t.defaultLayout.minW,
    minH: t.defaultLayout.minH,
  }));
  const defaults: ResponsiveLayouts = {
    lg: explicit,
    md: explicit,
    sm: stackTiles(tiles, 6),
    xs: stackTiles(tiles, 4),
    xxs: stackTiles(tiles, 2),
  } as Record<Breakpoint, LayoutItem[]>;
  return {
    tiles: tiles.map((t) => ({ id: t.id, title: t.title })),
    defaults,
  };
}
