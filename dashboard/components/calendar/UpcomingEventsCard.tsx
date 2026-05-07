// REVAMPED 2026-05-06: re-toned to match the new /calendar palette — neutral
// row text + small colored dot for signal (held = green, high-impact = amber)
// instead of the loud green/blue/amber pill chips.
import Link from "next/link";
import clsx from "clsx";
import { Card } from "@/components/ui/Card";
import { HoverTooltip } from "@/components/ui/HoverTooltip";
import {
  type CalendarEvent,
  mergeEvents,
  eventsByDate,
  isoToday,
  addDaysIso,
  isHighImpact,
} from "@/lib/calendar/events";
import type { EarningsEntry } from "@/lib/parsers/earningsCalendar.shared";
import type { EconomicEvent } from "@/lib/parsers/economicCalendar.shared";
import { etTimeStringToCT, fmtWeekdayShortCT } from "@/lib/time";

type Props = {
  earnings: EarningsEntry[];
  economic: EconomicEvent[];
};

export function UpcomingEventsCard({ earnings, economic }: Props) {
  const today = isoToday();
  const all = mergeEvents(earnings, economic);
  const horizon = addDaysIso(today, 6);
  const inWindow = all.filter((e) => e.date >= today && e.date <= horizon);
  const byDate = eventsByDate(inWindow);

  const days = Array.from({ length: 7 }, (_, i) => {
    const iso = addDaysIso(today, i);
    return { iso, events: byDate.get(iso) ?? [] };
  });

  const hasAny = inWindow.length > 0;

  return (
    <Card
      title="Upcoming events"
      subtitle="Next 7 days · earnings + economic calendar"
      right={
        <Link
          href="/calendar"
          className="text-[11px] text-[var(--color-muted)] hover:text-[var(--color-accent)]"
        >
          Full calendar →
        </Link>
      }
    >
      {!hasAny ? (
        <div className="text-xs text-[var(--color-muted)] py-2">
          No events in the next 7 days. Visit{" "}
          <Link href="/calendar" className="text-[var(--color-accent)] hover:underline">
            /calendar
          </Link>{" "}
          to refresh the economic calendar.
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
          {days.map(({ iso, events }) => (
            <DayColumn key={iso} iso={iso} events={events} today={today} />
          ))}
        </div>
      )}
    </Card>
  );
}

function DayColumn({
  iso,
  events,
  today,
}: {
  iso: string;
  events: CalendarEvent[];
  today: string;
}) {
  const m = iso.match(/^\d{4}-\d{2}-(\d{2})$/);
  const day = m ? Number(m[1]) : 0;
  const dow = fmtWeekdayShortCT(iso);
  const isToday = iso === today;
  const visible = events.slice(0, 3);
  const overflow = events.length - visible.length;

  return (
    <div
      className={clsx(
        "rounded border p-2 min-h-[80px]",
        isToday
          ? "border-[var(--color-accent)] bg-[var(--color-panel-2)]"
          : "border-[var(--color-border)] bg-[var(--color-panel)]"
      )}
    >
      <div className="flex items-baseline justify-between mb-1.5">
        <div className="text-[10px] uppercase tracking-wider text-[var(--color-muted)]">
          {dow}
        </div>
        <div
          className={clsx(
            "text-lg font-semibold tabular leading-none",
            isToday && "text-[var(--color-up)]"
          )}
        >
          {day}
        </div>
      </div>
      {events.length === 0 ? (
        <div className="text-[10px] text-[var(--color-muted)] opacity-60">—</div>
      ) : (
        <ul className="space-y-1">
          {visible.map((e, i) => (
            <li key={`${iso}-${i}`}>
              <EventRow event={e} />
            </li>
          ))}
          {overflow > 0 && (
            <li>
              <Link
                href="/calendar"
                className="text-[10px] text-[var(--color-muted)] hover:text-[var(--color-accent)]"
              >
                +{overflow} more
              </Link>
            </li>
          )}
        </ul>
      )}
    </div>
  );
}

function EventRow({ event }: { event: CalendarEvent }) {
  const isEarn = event.kind === "earnings";
  const isHeld = isEarn && event.entry.isHeld;
  const high = isHighImpact(event);
  const label =
    event.kind === "earnings"
      ? `${event.entry.symbol}${event.entry.type ? ` ${event.entry.type}` : ""}`
      : event.entry.event;

  return (
    <HoverTooltip content={<EventTooltipContent event={event} />}>
      <div
        tabIndex={0}
        className="flex items-center gap-1.5 text-[10px] tabular truncate outline-none focus-visible:ring-1 focus-visible:ring-[var(--color-accent)] rounded"
      >
        {isHeld && (
          <span
            className="size-1 rounded-full bg-[var(--color-up)] shrink-0"
            aria-label="held position"
          />
        )}
        {high && (
          <span
            className="size-1 rounded-full bg-[var(--color-warn)] shrink-0"
            aria-label="high impact"
          />
        )}
        <span className="text-[var(--color-text)] truncate">{label}</span>
      </div>
    </HoverTooltip>
  );
}

function EventTooltipContent({ event }: { event: CalendarEvent }) {
  if (event.kind === "earnings") {
    const e = event.entry;
    return (
      <div className="space-y-1">
        <div className="flex items-baseline gap-1.5">
          <span className="font-semibold text-[var(--color-text)]">{e.symbol}</span>
          {e.type && (
            <span className="text-[var(--color-muted)] text-[10px]">{e.type}</span>
          )}
          {e.isHeld && (
            <span className="ml-auto text-[9px] uppercase tracking-wider text-[var(--color-up)]">
              held
            </span>
          )}
        </div>
        {e.company && (
          <div className="text-[var(--color-muted)] truncate">{e.company}</div>
        )}
        <dl className="grid grid-cols-[auto,1fr] gap-x-2 gap-y-0.5">
          {e.epsEstimate && (
            <>
              <dt className="text-[var(--color-muted)]">EPS est</dt>
              <dd className="tabular text-[var(--color-text)]">{e.epsEstimate}</dd>
            </>
          )}
          {e.actualEps && (
            <>
              <dt className="text-[var(--color-muted)]">EPS actual</dt>
              <dd className="tabular text-[var(--color-text)]">{e.actualEps}</dd>
            </>
          )}
          {e.postPrintMovePct && (
            <>
              <dt className="text-[var(--color-muted)]">Post-print move</dt>
              <dd className="tabular text-[var(--color-text)]">{e.postPrintMovePct}</dd>
            </>
          )}
        </dl>
      </div>
    );
  }
  const e = event.entry;
  return (
    <div className="space-y-1">
      <div className="font-semibold text-[var(--color-text)]">{e.event}</div>
      <dl className="grid grid-cols-[auto,1fr] gap-x-2 gap-y-0.5">
        {e.time && (
          <>
            <dt className="text-[var(--color-muted)]">Time</dt>
            <dd className="tabular text-[var(--color-text)]">
              {etTimeStringToCT(e.time, event.date)} CT
            </dd>
          </>
        )}
        {e.importance && (
          <>
            <dt className="text-[var(--color-muted)]">Importance</dt>
            <dd
              className={clsx(
                "tabular",
                e.importance === "high"
                  ? "text-[var(--color-warn)]"
                  : "text-[var(--color-text)]"
              )}
            >
              {e.importance}
            </dd>
          </>
        )}
        {e.forecast && (
          <>
            <dt className="text-[var(--color-muted)]">Forecast</dt>
            <dd className="tabular text-[var(--color-text)]">{e.forecast}</dd>
          </>
        )}
        {e.previous && (
          <>
            <dt className="text-[var(--color-muted)]">Previous</dt>
            <dd className="tabular text-[var(--color-text)]">{e.previous}</dd>
          </>
        )}
      </dl>
    </div>
  );
}
