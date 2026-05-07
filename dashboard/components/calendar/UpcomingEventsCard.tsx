// REVAMPED 2026-05-06: re-toned to match the new /calendar palette — neutral
// row text + small colored dot for signal (held = green, high-impact = amber)
// instead of the loud green/blue/amber pill chips.
import Link from "next/link";
import clsx from "clsx";
import { Card } from "@/components/ui/Card";
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
  let label: string;
  let title: string;
  if (event.kind === "earnings") {
    const e = event.entry;
    label = `${e.symbol}${e.type ? ` ${e.type}` : ""}`;
    title = [
      e.symbol,
      e.company ? `(${e.company})` : "",
      e.type,
      e.epsEstimate ? `est ${e.epsEstimate}` : "",
      isHeld ? "[held]" : "",
    ]
      .filter(Boolean)
      .join(" ");
  } else {
    label = event.entry.event;
    title = `${event.entry.time ? `${etTimeStringToCT(event.entry.time, event.date)} CT — ` : ""}${event.entry.event}`;
  }
  return (
    <div className="flex items-center gap-1.5 text-[10px] tabular truncate" title={title}>
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
  );
}
