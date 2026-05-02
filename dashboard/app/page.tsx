import { Suspense } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { AccountPanel } from "@/components/live/AccountPanel";
import { AccountTabsControl } from "@/components/live/AccountTabs";
import { EquityCurve } from "@/components/charts/EquityCurve";
import { DrawdownNarrator } from "@/components/ai/DrawdownNarrator";
import { UpcomingEventsCard } from "@/components/calendar/UpcomingEventsCard";
import { PnlHero } from "@/components/live/PnlHero";
import { loadBenchmark } from "@/lib/parsers/benchmark";
import { loadResearchLog } from "@/lib/parsers/researchLog";
import {
  loadEarningsCalendar,
  type EarningsEntry,
} from "@/lib/parsers/earningsCalendar";
import { loadMarketEarnings } from "@/lib/parsers/marketEarnings";
import {
  loadEconomicCalendar,
  type EconomicEvent,
} from "@/lib/parsers/economicCalendar";
import { mergeEarnings } from "@/lib/calendar/events";
import { readBotMode } from "@/lib/mode";
import { activeTab } from "@/lib/activeTab";
import type { AlpacaMode } from "@/lib/alpacaMode";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const ACCOUNT_TABS = ["live", "paper"] as const;

function lastPortfolio(rows: { portfolio: number | null }[]): number | null {
  for (let i = rows.length - 1; i >= 0; i--) {
    const p = rows[i].portfolio;
    if (p != null) return p;
  }
  return null;
}

function weekStartPortfolio(
  rows: { date: string; portfolio: number | null }[]
): number | null {
  const today = new Date();
  const t0 = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const monday = new Date(t0);
  const dow = monday.getDay();
  const diff = dow === 0 ? -6 : 1 - dow;
  monday.setDate(monday.getDate() + diff);
  const mondayStr = monday.toISOString().slice(0, 10);
  for (const r of rows) {
    if (r.date >= mondayStr && r.portfolio != null) return r.portfolio;
  }
  return lastPortfolio(rows);
}

export default async function OverviewPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const sp = await searchParams;
  const defaultMode = await readBotMode();
  const accountMode = activeTab<AlpacaMode>(sp, "account", ACCOUNT_TABS, defaultMode);

  const benchmark = await loadBenchmark();

  const last = benchmark.rows[benchmark.rows.length - 1] ?? null;
  const yesterday = lastPortfolio(benchmark.rows);
  const weekStart = weekStartPortfolio(benchmark.rows);
  const spyPhasePct = last?.spyPhasePct ?? null;

  return (
    <div className="space-y-6">
      <PnlHero
        mode={accountMode}
        startingEquity={benchmark.startingEquity}
        phaseStart={benchmark.phaseStart}
        yesterdayPortfolio={yesterday}
        weekStartPortfolio={weekStart}
        spyPhasePct={spyPhasePct}
      />

      <Suspense fallback={null}>
        <DrawdownNarrator />
      </Suspense>

      <Card
        title="Equity vs SPY"
        subtitle={`Phase to date · ${benchmark.rows.length} trading days recorded`}
      >
        <EquityCurve
          data={benchmark.rows.map((r) => ({
            date: r.date,
            portfolio: r.portfolio,
            spy: r.spyClose,
          }))}
          startingEquity={benchmark.startingEquity}
        />
      </Card>

      <div className="space-y-4">
        <AccountTabsControl activeTab={accountMode} />
        <Suspense fallback={<AccountPanelSkeleton />}>
          <AccountPanel mode={accountMode} />
        </Suspense>
      </div>

      <div className="grid lg:grid-cols-5 gap-5">
        <div className="lg:col-span-3">
          <Suspense fallback={<UpcomingEventsSkeleton />}>
            <UpcomingEventsSection />
          </Suspense>
        </div>
        <div className="lg:col-span-2">
          <Suspense fallback={<LatestBriefSkeleton />}>
            <LatestBriefSection />
          </Suspense>
        </div>
      </div>
    </div>
  );
}

async function UpcomingEventsSection() {
  const [botEarningsMap, marketEarnings, economic] = await Promise.all([
    loadEarningsCalendar().catch(() => new Map<string, EarningsEntry>()),
    loadMarketEarnings().catch((): EarningsEntry[] => []),
    loadEconomicCalendar().catch((): EconomicEvent[] => []),
  ]);
  const earnings = mergeEarnings(Array.from(botEarningsMap.values()), marketEarnings);
  return <UpcomingEventsCard earnings={earnings} economic={economic} />;
}

async function LatestBriefSection() {
  const research = await loadResearchLog();
  const latest = research[0];
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

function AccountPanelSkeleton() {
  return (
    <div className="space-y-4">
      <div className="frost rounded-2xl h-20 animate-pulse" />
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="frost rounded-xl h-20 animate-pulse" />
        ))}
      </div>
      <div className="grid lg:grid-cols-2 gap-5">
        <div className="frost rounded-2xl h-48 animate-pulse" />
        <div className="frost rounded-2xl h-48 animate-pulse" />
      </div>
    </div>
  );
}

function UpcomingEventsSkeleton() {
  return <div className="frost rounded-2xl h-40 animate-pulse" />;
}

function LatestBriefSkeleton() {
  return <div className="frost rounded-2xl h-40 animate-pulse" />;
}
