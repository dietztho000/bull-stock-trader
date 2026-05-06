import { DashboardGrid } from "@/components/layout/DashboardGrid";
import { LayoutProvider } from "@/components/layout/LayoutEditContext";
import { EditLayoutToggle } from "@/components/layout/EditLayoutToggle";
import { LandingRedirect } from "@/components/providers/LandingRedirect";
import {
  OVERVIEW_LAYOUT,
  OVERVIEW_TILES,
  type OverviewCtx,
} from "@/components/layout/overview/registry";
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
import { loadLadderProgress, type LadderState } from "@/lib/parsers/ladderProgress";
import { runAlpaca, type RunAlpacaOpts } from "@/lib/alpaca";
import { loadOvernightGaps } from "@/lib/live/overnightGap";
import { mergeEarnings } from "@/lib/calendar/events";
import { resolveBotCtx } from "@/lib/resolveAccount";
import { listAccounts } from "@/lib/settings";
import { accountScope } from "@/lib/alpacaMode";
import { liveSpyPhasePct } from "@/lib/live/spyPhasePct";
import { liveWeekStartPortfolio } from "@/lib/live/weekStartPortfolio";
import { todayInCT, isTradingDayCT, currentWeekMondayCT } from "@/lib/time";
import { consecutiveWinningDays } from "@/lib/mascot/streak";

export const dynamic = "force-dynamic";
export const revalidate = 0;

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
  const mondayStr = currentWeekMondayCT();
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
  // Multi-bot context: `botId` keys all memory loads (BENCHMARK, RESEARCH-LOG,
  // EARNINGS-CALENDAR, ladder progress) and `accountId` scopes Alpaca queries
  // to the bot's bound account.
  const { botId, strategy, accountId, mode: accountMode } = await resolveBotCtx(sp);
  const memCtx = { bot: botId, strategy };
  const runOpts: RunAlpacaOpts = accountId ? { accountId } : { mode: accountMode };

  const accounts = accountId ? await listAccounts() : [];
  const accountLabel =
    accountId ? accounts.find((a) => a.id === accountId)?.label ?? null : null;

  const benchmark = await loadBenchmark(memCtx);

  const last = benchmark.rows[benchmark.rows.length - 1] ?? null;
  const mdWeekStart = weekStartPortfolio(benchmark.rows);
  const mdSpyPhasePct = last?.spyPhasePct ?? null;

  const today = todayInCT();
  const mdIsStaleToday = last?.date !== today && isTradingDayCT(today);
  const [liveSpy, liveWeek] = mdIsStaleToday
    ? await Promise.all([
        liveSpyPhasePct(benchmark.phaseStart),
        liveWeekStartPortfolio(accountMode, accountId),
      ])
    : [null, null];
  const spyPhasePct = liveSpy ?? mdSpyPhasePct;
  const weekStart = liveWeek ?? mdWeekStart;

  const [
    botEarningsMap,
    marketEarnings,
    economic,
    research,
    ladderMap,
  ] = await Promise.all([
    loadEarningsCalendar(memCtx).catch(() => new Map<string, EarningsEntry>()),
    loadMarketEarnings().catch((): EarningsEntry[] => []),
    loadEconomicCalendar().catch((): EconomicEvent[] => []),
    loadResearchLog(memCtx).catch(() => []),
    loadLadderProgress(memCtx).catch(() => new Map<string, LadderState>()),
  ]);

  let earnings: Record<string, EarningsEntry> | undefined;
  try {
    earnings = Object.fromEntries(botEarningsMap);
  } catch {
    earnings = undefined;
  }

  let overnightGaps: Record<string, number | null> | undefined;
  try {
    const positions = (await runAlpaca("positions", [], runOpts)) as Array<{
      symbol: string;
    }>;
    const symbols = positions.map((p) => p.symbol);
    if (symbols.length > 0) {
      const gapMap = await loadOvernightGaps(symbols, accountMode, accountId);
      overnightGaps = Object.fromEntries(gapMap);
    }
  } catch {
    overnightGaps = undefined;
  }

  const ladder = ladderMap.size > 0 ? Object.fromEntries(ladderMap) : undefined;

  const upcomingEarnings = mergeEarnings(
    Array.from(botEarningsMap.values()),
    marketEarnings
  );

  const ctx: OverviewCtx = {
    accountMode,
    accountId,
    scope: accountScope(accountMode, accountId),
    botId,
    strategy,
    accountLabel,
    benchmark,
    weekStartPortfolio: weekStart,
    spyPhasePct,
    winStreak: consecutiveWinningDays(benchmark.rows),
    earnings,
    overnightGaps,
    ladder,
    upcomingEarnings,
    economic,
    latestBrief: research[0] ?? null,
  };

  const tiles: Record<string, React.ReactNode> = Object.fromEntries(
    OVERVIEW_TILES.map((t) => [t.id, t.render(ctx)])
  );

  return (
    <LayoutProvider pageId="overview" spec={OVERVIEW_LAYOUT}>
      <LandingRedirect />
      <div className="space-y-5">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Overview</h1>
            <p className="text-xs text-[var(--color-muted)] mt-0.5">
              Live P&amp;L, equity curve, and today&apos;s catalysts.
            </p>
          </div>
          <EditLayoutToggle />
        </header>
        <DashboardGrid tiles={tiles} />
      </div>
    </LayoutProvider>
  );
}
