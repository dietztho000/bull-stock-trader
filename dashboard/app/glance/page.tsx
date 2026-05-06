import Link from "next/link";
import { PnlHero } from "@/components/live/PnlHero";
import { LivePositions } from "@/components/live/LivePositions";
import { MarketClock } from "@/components/live/MarketClock";
import { ForceExitBanner } from "@/components/live/ForceExitBanner";
import { EarningsGateBanner } from "@/components/live/EarningsGateBanner";
import { Card } from "@/components/ui/Card";
import { loadBenchmark } from "@/lib/parsers/benchmark";
import {
  loadEarningsCalendar,
  type EarningsEntry,
} from "@/lib/parsers/earningsCalendar";
import {
  loadLadderProgress,
  type LadderState,
} from "@/lib/parsers/ladderProgress";
import { runAlpaca, type RunAlpacaOpts } from "@/lib/alpaca";
import { loadOvernightGaps } from "@/lib/live/overnightGap";
import { resolveBotCtx } from "@/lib/resolveAccount";
import { listAccounts } from "@/lib/settings";
import { accountScope } from "@/lib/alpacaMode";
import { liveSpyPhasePct } from "@/lib/live/spyPhasePct";
import { liveWeekStartPortfolio } from "@/lib/live/weekStartPortfolio";
import {
  todayInCT,
  isTradingDayCT,
  currentWeekMondayCT,
  TZ_LABEL,
} from "@/lib/time";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/** Audit F9 — phone-friendly Quick Glance view. The full /overview page
 *  uses react-grid-layout which is overkill on a 375px screen; this page
 *  ships a vertical-scroll-only layout with the tiles a mobile operator
 *  actually needs to see at a glance: P&L hero, market state, positions,
 *  and the force-exit banner. No grid, no layout editor, no extra catalysts.
 *
 *  Same data sources as /overview so the dashboard's chokidar-driven
 *  invalidation continues to apply. Bookmark this URL on the home screen
 *  for a one-tap dashboard. */
function lastPortfolio(rows: { portfolio: number | null }[]): number | null {
  for (let i = rows.length - 1; i >= 0; i--) {
    const p = rows[i].portfolio;
    if (p != null) return p;
  }
  return null;
}

function weekStartFromRows(
  rows: { date: string; portfolio: number | null }[]
): number | null {
  const mondayStr = currentWeekMondayCT();
  for (const r of rows) {
    if (r.date >= mondayStr && r.portfolio != null) return r.portfolio;
  }
  return lastPortfolio(rows);
}

export default async function GlancePage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const sp = await searchParams;
  const { botId, strategy, accountId, mode: accountMode } = await resolveBotCtx(sp);
  const memCtx = { bot: botId, strategy };
  const scope = accountScope(accountMode, accountId);
  const runOpts: RunAlpacaOpts = accountId ? { accountId } : { mode: accountMode };
  const forceSymbol = typeof sp.force === "string" ? sp.force : null;

  const accounts = accountId ? await listAccounts() : [];
  const accountLabel =
    accountId ? accounts.find((a) => a.id === accountId)?.label ?? null : null;

  const benchmark = await loadBenchmark(memCtx);
  const last = benchmark.rows[benchmark.rows.length - 1] ?? null;
  const mdWeekStart = weekStartFromRows(benchmark.rows);
  const today = todayInCT();
  const isStale = last?.date !== today && isTradingDayCT(today);
  const [liveSpy, liveWeek] = isStale
    ? await Promise.all([
        liveSpyPhasePct(benchmark.phaseStart),
        liveWeekStartPortfolio(accountMode, accountId),
      ])
    : [null, null];
  const spyPhasePct = liveSpy ?? last?.spyPhasePct ?? null;
  const weekStart = liveWeek ?? mdWeekStart;

  const [botEarningsMap, ladderMap] = await Promise.all([
    loadEarningsCalendar(memCtx).catch(() => new Map<string, EarningsEntry>()),
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

  return (
    <div className="space-y-4 max-w-md mx-auto">
      <header className="flex items-center justify-between gap-2 px-1">
        <div className="min-w-0">
          <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--color-muted)] font-semibold">
            Quick Glance
          </div>
          <div className="text-sm font-semibold truncate">
            {accountLabel ?? botId} ·{" "}
            <span className="text-[var(--color-muted)]">{accountMode}</span>
          </div>
        </div>
        <Link
          href={`/?bot=${encodeURIComponent(botId)}`}
          className="text-[11px] text-[var(--color-accent)] hover:underline"
        >
          Full view →
        </Link>
      </header>

      {forceSymbol ? <ForceExitBanner symbol={forceSymbol} /> : null}

      <PnlHero
        scope={scope}
        startingEquity={benchmark.startingEquity}
        phaseStart={benchmark.phaseStart}
        weekStartPortfolio={weekStart}
        spyPhasePct={spyPhasePct}
      />

      <EarningsGateBanner />

      <Card title={`Market (${TZ_LABEL})`}>
        <MarketClock />
      </Card>

      <LivePositions
        scope={scope}
        earnings={earnings}
        overnightGaps={overnightGaps}
        ladder={ladder}
      />
    </div>
  );
}
