import { Card, Badge } from "@/components/ui/Card";
import { CalendarView } from "@/components/calendar/CalendarView";
import { UrlTabs } from "@/components/ui/UrlTabs";
import { activeTab } from "@/lib/activeTab";
import { loadResearchLog } from "@/lib/parsers/researchLog";
import { loadSectorLedger } from "@/lib/parsers/sectorLedger";
import { loadWeeklyReviews } from "@/lib/parsers/weeklyReview";
import { cooldownStatus } from "@/lib/stats/cooldown";
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

export const dynamic = "force-dynamic";
export const revalidate = 0;

const TABS = ["research", "weekly", "calendar"] as const;
type Tab = (typeof TABS)[number];

const TAB_OPTIONS: { value: Tab; label: string }[] = [
  { value: "research", label: "Research" },
  { value: "weekly", label: "Weekly" },
  { value: "calendar", label: "Calendar" },
];

export default async function JournalPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const sp = await searchParams;
  const tab = activeTab<Tab>(sp, "tab", TABS, "research");

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Journal</h1>
          <p className="text-xs text-[var(--color-muted)] mt-0.5">
            Pre-market research, Friday reviews, and the market calendar.
          </p>
        </div>
        <UrlTabs<Tab> layoutId="journal-tabs" options={TAB_OPTIONS} fallback="research" />
      </header>

      {tab === "research" && <ResearchTab />}
      {tab === "weekly" && <WeeklyTab />}
      {tab === "calendar" && <CalendarTab />}
    </div>
  );
}

function extractTicker(idea: string): string | null {
  const m = idea.match(/^([A-Z]{1,5})\b/);
  return m?.[1] ?? null;
}

async function ResearchTab() {
  const [entries, ledger] = await Promise.all([
    loadResearchLog(),
    loadSectorLedger(),
  ]);
  const todayDate = entries[0]?.date;

  if (entries.length === 0) {
    return (
      <Card title="No entries yet">
        <div className="text-sm text-[var(--color-muted)]">
          Pre-market research will appear here once the bot starts running its 6 AM
          routine.
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {entries.map((e) => {
        const isToday = e.date === todayDate;
        return (
          <Card
            key={e.date}
            title={e.date}
            right={
              e.decision ? (
                <Badge
                  tone={
                    /TRADE/i.test(e.decision)
                      ? "up"
                      : /HOLD/i.test(e.decision)
                      ? "neutral"
                      : "warn"
                  }
                >
                  {e.decision}
                </Badge>
              ) : null
            }
          >
            {e.ideas.length > 0 && (
              <div className="mb-3">
                <div className="text-[10px] uppercase tracking-[0.14em] text-[var(--color-muted)] font-medium mb-2">
                  Ideas
                </div>
                <ul className="text-sm space-y-1.5">
                  {e.ideas.map((idea, idx) => {
                    const ticker = extractTicker(idea);
                    const cd =
                      isToday && ticker
                        ? cooldownStatus(ticker, ledger.closed, e.date)
                        : null;
                    const blocked = cd?.blocked ?? false;
                    return (
                      <li
                        key={idx}
                        className={
                          blocked
                            ? "line-through text-[var(--color-muted)]"
                            : "text-[var(--color-text)]"
                        }
                      >
                        <span className="text-[var(--color-muted)] mr-2">·</span>
                        <span>{idea}</span>
                        {blocked && cd && (
                          <span className="ml-2 inline-flex items-baseline gap-1.5">
                            <Badge tone="down">
                              Cooldown: stopped {cd.lastLossDate}, {cd.daysRemaining}d
                              remaining
                            </Badge>
                          </span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
            <details className="text-xs">
              <summary className="cursor-pointer text-[var(--color-muted)] hover:text-[var(--color-accent)]">
                Full entry
              </summary>
              <pre className="whitespace-pre-wrap mt-2 leading-relaxed text-[var(--color-text)]">
                {e.body}
              </pre>
            </details>
          </Card>
        );
      })}
    </div>
  );
}

async function WeeklyTab() {
  const reviews = await loadWeeklyReviews();
  if (reviews.length === 0) {
    return (
      <Card title="No reviews yet">
        <div className="text-sm text-[var(--color-muted)]">
          Weekly reviews land Friday afternoon after the /weekly-review routine.
        </div>
      </Card>
    );
  }
  return (
    <div className="space-y-4">
      {reviews.map((r) => (
        <Card
          key={r.weekEnding}
          title={`Week ending ${r.weekEnding}`}
          right={
            r.grade ? (
              <Badge tone={/A/i.test(r.grade) ? "up" : "neutral"}>Grade {r.grade}</Badge>
            ) : null
          }
        >
          {Object.keys(r.stats).length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-1 text-sm mb-3">
              {Object.entries(r.stats).map(([k, v]) => (
                <div
                  key={k}
                  className="flex justify-between border-b border-[rgba(255,255,255,0.04)] py-1"
                >
                  <span className="text-[var(--color-muted)]">{k}</span>
                  <span className="tabular">{v}</span>
                </div>
              ))}
            </div>
          )}
          <details className="text-xs">
            <summary className="cursor-pointer text-[var(--color-muted)] hover:text-[var(--color-accent)]">
              Full review
            </summary>
            <pre className="whitespace-pre-wrap mt-2 leading-relaxed text-[var(--color-text)]">
              {r.body}
            </pre>
          </details>
        </Card>
      ))}
    </div>
  );
}

async function CalendarTab() {
  const [botEarningsMap, marketEarnings, economic] = await Promise.all([
    loadEarningsCalendar().catch(() => new Map<string, EarningsEntry>()),
    loadMarketEarnings().catch((): EarningsEntry[] => []),
    loadEconomicCalendar().catch((): EconomicEvent[] => []),
  ]);
  const earnings = mergeEarnings(Array.from(botEarningsMap.values()), marketEarnings);
  const refreshedAt = new Date().toISOString();
  return (
    <CalendarView earnings={earnings} economic={economic} refreshedAt={refreshedAt} />
  );
}
