import Link from "next/link";
import { PnlHero } from "@/components/live/PnlHero";
import { LivePositions } from "@/components/live/LivePositions";
import { MarketClock } from "@/components/live/MarketClock";
import { ForceExitBanner } from "@/components/live/ForceExitBanner";
import { EarningsGateBanner } from "@/components/live/EarningsGateBanner";
import { Card } from "@/components/ui/Card";
import { loadBenchmark } from "@/lib/parsers/benchmark";
import { resolveBotCtx } from "@/lib/resolveAccount";
import { listAccounts } from "@/lib/settings";
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
  const forceSymbol = typeof sp.force === "string" ? sp.force : null;

  const accounts = accountId ? await listAccounts() : [];
  const accountLabel =
    accountId ? accounts.find((a) => a.id === accountId)?.label ?? null : null;

  const benchmark = await loadBenchmark({ bot: botId, strategy });
  const last = benchmark.rows[benchmark.rows.length - 1] ?? null;
  const yesterday = lastPortfolio(benchmark.rows);
  const mdWeekStart = weekStartFromRows(benchmark.rows);
  const today = todayInCT();
  const isStale = last?.date !== today && isTradingDayCT(today);
  const [liveSpy, liveWeek] = isStale
    ? await Promise.all([
        liveSpyPhasePct(benchmark.phaseStart),
        liveWeekStartPortfolio(accountMode),
      ])
    : [null, null];
  const spyPhasePct = liveSpy ?? last?.spyPhasePct ?? null;
  const weekStart = liveWeek ?? mdWeekStart;

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
        mode={accountMode}
        accountId={accountId}
        startingEquity={benchmark.startingEquity}
        phaseStart={benchmark.phaseStart}
        yesterdayPortfolio={yesterday}
        weekStartPortfolio={weekStart}
        spyPhasePct={spyPhasePct}
      />

      <EarningsGateBanner />

      <Card title={`Market (${TZ_LABEL})`}>
        <MarketClock />
      </Card>

      <LivePositions mode={accountMode} accountId={accountId} />
    </div>
  );
}
