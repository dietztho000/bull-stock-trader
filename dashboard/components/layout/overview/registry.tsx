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
import { BullMascotTile } from "@/components/mascot/BullMascotTile";
import { EarningsGateBanner } from "@/components/live/EarningsGateBanner";
import { OrderEntryTile } from "@/components/live/OrderEntryTile";
import { PositionManagementTile } from "@/components/live/PositionManagementTile";

import type { PageLayoutSpec } from "@/components/layout/defaults";
import type { AlpacaMode, AlpacaScope } from "@/lib/alpacaMode";
import type { BenchmarkData } from "@/lib/parsers/benchmark";
import type { EarningsEntry } from "@/lib/parsers/earningsCalendar";
import type { LadderState } from "@/lib/parsers/ladderProgress";
import type { ResearchEntry } from "@/lib/parsers/researchLog";
import type { EconomicEvent } from "@/lib/parsers/economicCalendar";

export type OverviewCtx = {
  accountMode: AlpacaMode;
  /** The bot's bound account id, when resolved from the registry. Live tiles
   *  prefer this over `accountMode` so a `momentum-10k → paper-100k` bot
   *  queries the right Alpaca account, not whichever paper happens to live in
   *  `ALPACA_PAPER_*`. Null on legacy installs without the registry. */
  accountId: string | null;
  /** Audit NA1 — discriminated `AlpacaScope` mirroring the (mode, accountId)
   *  pair above. Tiles migrated to the new prop shape consume this directly;
   *  legacy tiles continue to read `accountMode`/`accountId` until their next
   *  touch. Both views are kept in sync by `app/page.tsx` which builds the
   *  ctx in one place. */
  scope: AlpacaScope;
  /** Bot id resolved from `?account=`. Threaded into write paths so tagged
   *  client_order_id prefixes apply for soft-allocation P&L attribution. */
  botId: string;
  /** Strategy slug for memory paths (`memory/<bot>/<strategy>/`). */
  strategy: string;
  /** Display label for the bot's bound account, when resolved. */
  accountLabel: string | null;
  benchmark: BenchmarkData;
  weekStartPortfolio: number | null;
  spyPhasePct: number | null;
  winStreak: number | null;
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
        <AccountIdentityTile
          mode={ctx.accountMode}
          scope={ctx.scope}
          accountLabel={ctx.accountLabel}
          botId={ctx.botId}
        />
      </Suspense>
    ),
  },
  {
    id: "pnl-hero",
    title: "P&L hero",
    defaultLayout: { x: 4, y: 0, w: 8, h: 4, minW: 4, minH: 3 },
    render: (ctx) => (
      <PnlHero
        scope={ctx.scope}
        startingEquity={ctx.benchmark.startingEquity}
        phaseStart={ctx.benchmark.phaseStart}
        weekStartPortfolio={ctx.weekStartPortfolio}
        spyPhasePct={ctx.spyPhasePct}
      />
    ),
  },
  {
    id: "equity-kpi",
    title: "Equity",
    defaultLayout: { x: 0, y: 4, w: 3, h: 3, minW: 2, minH: 2 },
    render: (ctx) => <EquityKpiTile scope={ctx.scope} />,
  },
  {
    id: "cash-kpi",
    title: "Cash",
    defaultLayout: { x: 3, y: 4, w: 3, h: 3, minW: 2, minH: 2 },
    render: (ctx) => <CashKpiTile scope={ctx.scope} />,
  },
  {
    id: "deployed-kpi",
    title: "Deployed",
    defaultLayout: { x: 6, y: 4, w: 3, h: 3, minW: 2, minH: 2 },
    render: (ctx) => <DeployedKpiTile scope={ctx.scope} />,
  },
  {
    id: "buying-power-kpi",
    title: "Buying power",
    defaultLayout: { x: 9, y: 4, w: 3, h: 3, minW: 2, minH: 2 },
    render: (ctx) => <BuyingPowerKpiTile scope={ctx.scope} />,
  },
  {
    id: "day-trades-kpi",
    title: "Day trades",
    defaultLayout: { x: 0, y: 7, w: 3, h: 3, minW: 2, minH: 2 },
    render: (ctx) => <DayTradesKpiTile scope={ctx.scope} />,
  },
  {
    id: "risk-gate",
    title: "Risk gate",
    defaultLayout: { x: 0, y: 7, w: 12, h: 5, minW: 4, minH: 3 },
    render: () => <EarningsGateBanner />,
  },
  {
    id: "drawdown-narrator",
    title: "Drawdown narrator",
    defaultLayout: { x: 3, y: 12, w: 9, h: 3, minW: 4, minH: 2 },
    render: (ctx) => (
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
        <DrawdownNarrator botId={ctx.botId} strategy={ctx.strategy} />
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
        scope={ctx.scope}
        earnings={ctx.earnings}
        overnightGaps={ctx.overnightGaps}
        ladder={ctx.ladder}
      />
    ),
  },
  {
    id: "order-entry",
    title: "Order entry",
    defaultLayout: { x: 0, y: 18, w: 6, h: 8, minW: 4, minH: 6 },
    render: () => <OrderEntryTile />,
  },
  {
    id: "position-management",
    title: "Position management",
    defaultLayout: { x: 6, y: 18, w: 6, h: 8, minW: 4, minH: 6 },
    render: () => <PositionManagementTile />,
  },
  {
    id: "orders",
    title: "Open orders",
    defaultLayout: { x: 0, y: 26, w: 12, h: 5, minW: 4, minH: 4 },
    render: (ctx) => <OrdersTile scope={ctx.scope} />,
  },
  {
    id: "upcoming-events",
    title: "Upcoming events",
    defaultLayout: { x: 0, y: 31, w: 7, h: 8, minW: 3, minH: 4 },
    render: (ctx) => (
      <UpcomingEventsCard earnings={ctx.upcomingEarnings} economic={ctx.economic} />
    ),
  },
  {
    id: "latest-brief",
    title: "Latest brief",
    defaultLayout: { x: 7, y: 31, w: 5, h: 8, minW: 3, minH: 4 },
    render: (ctx) => <LatestBriefSection latest={ctx.latestBrief} />,
  },
  {
    id: "bull-mascot",
    title: "Trader Max",
    defaultLayout: { x: 0, y: 39, w: 4, h: 6, minW: 3, minH: 5 },
    render: (ctx) => (
      <BullMascotTile
        scope={ctx.scope}
        ctxOverride={{
          winStreak: ctx.winStreak,
          spyPhasePct: ctx.spyPhasePct,
          phaseStart: ctx.benchmark.phaseStart,
          startingEquity: ctx.benchmark.startingEquity,
          recentRows: ctx.benchmark.rows
            .slice(-7)
            .map((r) => ({ date: r.date, portfolio: r.portfolio })),
        }}
      />
    ),
  },
];

function LatestBriefSection({ latest }: { latest: ResearchEntry | null }) {
  if (!latest) {
    return (
      <Card title="Latest brief">
        <div className="space-y-1.5">
          <p className="text-xs text-[var(--color-muted)] leading-relaxed">
            Today's pre-market research will appear here. Until then, the most
            recent brief is in the Journal.
          </p>
          <p className="text-[11px] text-[var(--color-muted)] tabular">
            <span className="text-[var(--color-text)]">Next:</span> ~6 AM CT
            (Mon–Fri)
          </p>
          <Link
            href="/journal"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--color-accent)] hover:underline pt-1"
          >
            Open journal <span aria-hidden="true">→</span>
          </Link>
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
