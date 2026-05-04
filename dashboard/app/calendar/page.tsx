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
  const [botEarningsMap, marketEarnings, economic] = await Promise.all([
    loadEarningsCalendar({ bot: botId, strategy }).catch(() => new Map<string, EarningsEntry>()),
    loadMarketEarnings().catch((): EarningsEntry[] => []),
    loadEconomicCalendar().catch((): EconomicEvent[] => []),
  ]);
  const earnings = mergeEarnings(
    Array.from(botEarningsMap.values()),
    marketEarnings
  );
  const refreshedAt = new Date().toISOString();

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
      />
    </div>
  );
}
