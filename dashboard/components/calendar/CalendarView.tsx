"use client";

import { useMemo } from "react";
import Link from "next/link";
import clsx from "clsx";
import { Card, Badge } from "@/components/ui/Card";
import {
  type CalendarEvent,
  type CalendarFilter,
  isHighImpact,
} from "@/lib/calendar/events";
import {
  type EarningsEntry,
  daysUntilEarnings,
} from "@/lib/parsers/earningsCalendar.shared";
import type { EconomicEvent } from "@/lib/parsers/economicCalendar.shared";
import { etTimeStringToCT } from "@/lib/time";
import { RefreshEconomicButton } from "./RefreshEconomicButton";
import { RefreshMarketEarningsButton } from "./RefreshMarketEarningsButton";
import { useCalendarFilters } from "./useCalendarFilters";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

type Props = {
  earnings: EarningsEntry[];
  economic: EconomicEvent[];
  refreshedAt?: string | null;
};

export function CalendarView({ earnings, economic, refreshedAt }: Props) {
  const {
    filter,
    setFilter,
    today,
    cursor,
    setCursor,
    selected,
    setSelected,
    byDate,
    selectedEvents,
    upcoming,
  } = useCalendarFilters(earnings, economic);

  const grid = useMemo(() => buildMonthGrid(cursor), [cursor]);
  const monthLabel = useMemo(() => {
    const m = cursor.match(/^(\d{4})-(\d{2})/);
    if (!m) return cursor;
    return `${MONTHS[Number(m[2]) - 1]} ${m[1]}`;
  }, [cursor]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <FilterToggle value={filter} onChange={setFilter} />
        <div className="flex flex-wrap items-center gap-2">
          <RefreshMarketEarningsButton />
          <RefreshEconomicButton refreshedAt={refreshedAt} />
        </div>
      </div>

      <div className="grid lg:grid-cols-[minmax(0,1fr)_320px] gap-5">
        <Card
          title={monthLabel}
          right={
            <div className="flex items-center gap-1">
              <NavButton onClick={() => setCursor(shiftMonth(cursor, -1))} label="‹ Prev" />
              <NavButton onClick={() => setCursor(isoFirstOfMonth(today))} label="Today" />
              <NavButton onClick={() => setCursor(shiftMonth(cursor, 1))} label="Next ›" />
            </div>
          }
        >
          <div className="grid grid-cols-7 gap-px border border-[var(--color-border)] bg-[var(--color-border)] rounded overflow-hidden">
            {WEEKDAYS.map((w) => (
              <div
                key={w}
                className="bg-[var(--color-panel)] px-2 py-1.5 text-[10px] uppercase tracking-wider text-[var(--color-muted)] text-center"
              >
                {w}
              </div>
            ))}
            {grid.map((cell) => {
              const dayEvents = byDate.get(cell.iso) ?? [];
              const isToday = cell.iso === today;
              const isSelected = cell.iso === selected;
              return (
                <button
                  key={cell.iso}
                  type="button"
                  onClick={() => setSelected(cell.iso)}
                  className={clsx(
                    "min-h-[68px] sm:min-h-[80px] bg-[var(--color-panel)] px-1.5 py-1 text-left transition-colors",
                    "hover:bg-[var(--color-panel-2)]",
                    !cell.inMonth && "opacity-40",
                    isSelected && "ring-2 ring-[var(--color-accent)] ring-inset relative z-10"
                  )}
                >
                  <div
                    className={clsx(
                      "inline-flex items-center justify-center w-5 h-5 text-[11px] tabular rounded",
                      isToday && "bg-[var(--color-up)] text-black font-bold",
                      !isToday && "text-[var(--color-text)]"
                    )}
                  >
                    {Number(cell.iso.slice(-2))}
                  </div>
                  <div className="mt-0.5 flex flex-col gap-0.5">
                    {dayEvents.slice(0, 3).map((e, i) => (
                      <EventPill key={`${e.date}-${i}`} event={e} compact />
                    ))}
                    {dayEvents.length > 3 && (
                      <div className="text-[9px] text-[var(--color-muted)] px-1">
                        +{dayEvents.length - 3} more
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </Card>

        <Card title={selected ? `Events on ${selected}` : "Select a day"}>
          {selectedEvents.length === 0 ? (
            <div className="text-xs text-[var(--color-muted)] py-2">
              No events on this date.
            </div>
          ) : (
            <ul className="space-y-3">
              {selectedEvents.map((e, i) => (
                <li key={`${e.date}-${i}`}>
                  <EventDetail event={e} />
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card
        title="Upcoming events"
        subtitle={`Next 30 days · ${upcoming.length} events`}
      >
        {upcoming.length === 0 ? (
          <EmptyState filter={filter} />
        ) : (
          <ul className="divide-y divide-[var(--color-border)]">
            {upcoming.map((e, i) => (
              <li
                key={`${e.date}-${i}`}
                className="py-2 flex items-center justify-between gap-3 hover:bg-[var(--color-panel-2)] -mx-2 px-2 rounded cursor-pointer"
                onClick={() => setSelected(e.date)}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="text-[11px] font-mono text-[var(--color-muted)] w-20 shrink-0">
                    {e.date}
                  </div>
                  <EventPill event={e} />
                  <div className="text-sm truncate">
                    {e.kind === "earnings" ? (
                      <>
                        <span className="font-semibold">{e.entry.symbol}</span>
                        {e.entry.type ? (
                          <span className="text-[var(--color-muted)]"> ({e.entry.type})</span>
                        ) : null}
                        {e.entry.company ? (
                          <span className="text-[var(--color-muted)]"> · {e.entry.company}</span>
                        ) : null}
                        {e.entry.epsEstimate ? (
                          <span className="text-[var(--color-muted)] font-mono"> · est {e.entry.epsEstimate}</span>
                        ) : null}
                      </>
                    ) : (
                      `${e.entry.time ? `${etTimeStringToCT(e.entry.time, e.date)} CT — ` : ""}${e.entry.event}`
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {e.kind === "earnings" && e.entry.isHeld && <Badge tone="up">held</Badge>}
                  {e.kind === "economic" && e.entry.importance && (
                    <ImportanceBadge importance={e.entry.importance} />
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function FilterToggle({
  value,
  onChange,
}: {
  value: CalendarFilter;
  onChange: (v: CalendarFilter) => void;
}) {
  const options: { v: CalendarFilter; label: string }[] = [
    { v: "all", label: "All" },
    { v: "earnings", label: "Earnings" },
    { v: "economic", label: "Economic" },
  ];
  return (
    <div className="inline-flex rounded-md border border-[var(--color-border)] overflow-hidden text-xs">
      {options.map((o) => (
        <button
          key={o.v}
          type="button"
          onClick={() => onChange(o.v)}
          className={clsx(
            "px-3 py-1.5 transition-colors",
            value === o.v
              ? "bg-[var(--color-accent)] text-black font-semibold"
              : "bg-[var(--color-panel)] text-[var(--color-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-panel-2)]"
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function NavButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="px-2 py-1 text-[11px] rounded border border-[var(--color-border)] bg-[var(--color-panel)] text-[var(--color-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-panel-2)]"
    >
      {label}
    </button>
  );
}

function EventPill({ event, compact }: { event: CalendarEvent; compact?: boolean }) {
  const isEarn = event.kind === "earnings";
  const isHeld = isEarn && event.entry.isHeld;
  const high = isHighImpact(event);
  const base = "inline-flex items-center rounded text-[10px] font-medium border tabular px-1.5 py-0.5 truncate max-w-full";
  const cls = clsx(
    base,
    isEarn && isHeld && "bg-green-500/20 text-[var(--color-up)] border-green-500/50 ring-1 ring-green-500/40",
    isEarn && !isHeld && "bg-green-500/10 text-[var(--color-up)] border-green-500/30",
    !isEarn && !high && "bg-blue-500/10 text-[#7ab7ff] border-blue-500/30",
    !isEarn && high && "bg-amber-500/10 text-[var(--color-warn)] border-amber-500/40 ring-1 ring-amber-500/30"
  );
  if (compact) {
    return (
      <span className={cls}>
        {event.kind === "earnings"
          ? event.entry.symbol
          : truncate(event.entry.event, 14)}
      </span>
    );
  }
  return (
    <span className={cls}>
      {event.kind === "earnings" ? "Earnings" : "Economic"}
    </span>
  );
}

function ImportanceBadge({ importance }: { importance: string }) {
  if (importance === "high") return <Badge tone="warn">high impact</Badge>;
  if (importance === "medium") return <Badge tone="neutral">medium</Badge>;
  if (importance === "low") return <Badge tone="neutral">low</Badge>;
  return null;
}

function EventDetail({ event }: { event: CalendarEvent }) {
  if (event.kind === "earnings") {
    const e = event.entry;
    const days = daysUntilEarnings(e.date);
    const dayBadge =
      days != null && days >= 0 ? (
        days === 0 ? (
          <Badge tone="down">EPS today</Badge>
        ) : days <= 2 ? (
          <Badge tone="down">T-{days}</Badge>
        ) : days <= 5 ? (
          <Badge tone="warn">T-{days}</Badge>
        ) : null
      ) : null;
    return (
      <div className="space-y-1.5">
        <div className="flex items-center gap-2 flex-wrap">
          <EventPill event={event} />
          <div className="text-base font-semibold tabular">{e.symbol}</div>
          {e.type && <Badge tone="neutral">{e.type}</Badge>}
          {e.isHeld && <Badge tone="up">held</Badge>}
          {dayBadge}
        </div>
        {e.company && <Detail label="Company" value={e.company} />}
        <Detail label="Date" value={e.date} mono />
        {e.epsEstimate && <Detail label="EPS estimate" value={e.epsEstimate} mono />}
        {e.source && <Detail label="Source" value={e.source} />}
        {e.refreshed && <Detail label="Refreshed" value={e.refreshed} mono />}
        {e.isHeld && (
          <div className="pt-2 mt-2 border-t border-[rgba(255,255,255,0.05)]">
            <Link
              href={`/trades?force=${encodeURIComponent(e.symbol)}`}
              className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full glass glass-interactive glass-tint-down font-semibold"
            >
              ⚠️ Force-exit at close (rule #13)
            </Link>
            <p className="mt-1.5 text-[10px] text-[var(--color-muted)]">
              Bot routine market-open auto-exits the day before; this CTA jumps
              to Trades for a manual override.
            </p>
          </div>
        )}
      </div>
    );
  }
  const e = event.entry;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2 flex-wrap">
        <EventPill event={event} />
        <div className="text-sm font-semibold">{e.event}</div>
        {e.importance && <ImportanceBadge importance={e.importance} />}
      </div>
      {e.time && (
        <Detail label="Time (CT)" value={etTimeStringToCT(e.time, event.date)} mono />
      )}
      {e.forecast && <Detail label="Forecast" value={e.forecast} />}
      {e.previous && <Detail label="Previous" value={e.previous} />}
      {e.source && <Detail label="Source" value={e.source} />}
      {e.refreshed && <Detail label="Refreshed" value={e.refreshed} mono />}
    </div>
  );
}

function Detail({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-2 text-xs">
      <span className="text-[var(--color-muted)] uppercase tracking-wider text-[10px]">
        {label}
      </span>
      <span className={clsx("text-[var(--color-text)]", mono && "font-mono")}>{value}</span>
    </div>
  );
}

function EmptyState({ filter }: { filter: CalendarFilter }) {
  const msg =
    filter === "economic"
      ? "No economic events cached. Click Refresh to query Perplexity for the next 14 days."
      : filter === "earnings"
      ? "No upcoming earnings on the bot's watchlist. The pre-market routine refreshes EARNINGS-CALENDAR.md daily."
      : "No upcoming events. Try clicking Refresh, or run the bot's pre-market routine.";
  return <div className="text-xs text-[var(--color-muted)] py-3">{msg}</div>;
}

function isoFirstOfMonth(iso: string): string {
  return `${iso.slice(0, 7)}-01`;
}

function shiftMonth(iso: string, delta: number): string {
  const m = iso.match(/^(\d{4})-(\d{2})/);
  if (!m) return iso;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-01`;
}

function buildMonthGrid(monthStart: string): { iso: string; inMonth: boolean }[] {
  const m = monthStart.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return [];
  const year = Number(m[1]);
  const monthIdx = Number(m[2]) - 1;
  const first = new Date(Date.UTC(year, monthIdx, 1));
  const startOffset = first.getUTCDay(); // 0 = Sunday
  const cells: { iso: string; inMonth: boolean }[] = [];
  // 42 cells = 6 rows. Trim trailing all-out-of-month rows below.
  for (let i = 0; i < 42; i++) {
    const d = new Date(Date.UTC(year, monthIdx, 1 - startOffset + i));
    const iso = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
    cells.push({ iso, inMonth: d.getUTCMonth() === monthIdx });
  }
  // Drop the last row if all are out-of-month (keeps grid tight for short months).
  while (cells.length >= 7 && cells.slice(-7).every((c) => !c.inMonth)) {
    cells.splice(-7, 7);
  }
  return cells;
}

function truncate(s: string, n: number): string {
  return s.length <= n ? s : s.slice(0, n - 1) + "…";
}
