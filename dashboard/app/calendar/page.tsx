// REVAMPED 2026-05-06: load SECTOR-MAP.md (already in MEMORY_FILE_SCOPE)
// and WATCHLIST.md (newly registered) so the new agenda layout can show
// a Sector column and watchlist stars without changing the earnings memory
// schema. Failures load to empty data — calendar still renders.
import { CalendarView } from "@/components/calendar/CalendarView";
import {
  loadEarningsCalendar,
  type EarningsEntry,
} from "@/lib/parsers/earningsCalendar";
import { loadMarketEarnings } from "@/lib/parsers/marketEarnings";
import {
  loadEconomicCalendar,
  type EconomicEvent,
} from "@/lib/parsers/economicCalendar";
import { loadSectorMap } from "@/lib/parsers/sectorMap";
import { loadWatchlist } from "@/lib/parsers/watchlist";
import { mergeEarnings } from "@/lib/calendar/events";
import { resolveBotCtx } from "@/lib/resolveAccount";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const sp = await searchParams;
  const { botId, strategy } = await resolveBotCtx(sp);
  const [botEarningsMap, marketEarnings, economic, sectorMap, watchlist] =
    await Promise.all([
      loadEarningsCalendar({ bot: botId, strategy }).catch(
        () => new Map<string, EarningsEntry>()
      ),
      loadMarketEarnings().catch((): EarningsEntry[] => []),
      loadEconomicCalendar().catch((): EconomicEvent[] => []),
      loadSectorMap().catch(() => new Map<string, string>()),
      loadWatchlist().catch(() => []),
    ]);
  const earnings = mergeEarnings(
    Array.from(botEarningsMap.values()),
    marketEarnings
  );
  const refreshedAt = new Date().toISOString();
  const initialWatchlist = watchlist.map((w) => w.symbol);

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Calendar</h1>
        <p className="text-xs text-[var(--color-muted)] mt-0.5">
          Earnings prints and economic releases — bot positions overlaid where
          relevant.
        </p>
      </header>
      <CalendarView
        earnings={earnings}
        economic={economic}
        refreshedAt={refreshedAt}
        sectorMap={sectorMap}
        initialWatchlist={initialWatchlist}
      />
    </div>
  );
}
