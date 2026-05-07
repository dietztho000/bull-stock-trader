"use client";

// REVAMPED 2026-05-06: replaced the month-grid + 320px right-side detail
// panel with a day-grouped agenda. Pill colors toned down to a quiet
// monochrome scheme with single-color dots for signal (held = green dot,
// high-impact = amber dot). Added: search box, held-only toggle,
// high-impact-only toggle, CSV export, watchlist stars, sector column,
// inline post-print results — all without a parallel chip system.

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { Card, Badge } from "@/components/ui/Card";
import {
  type CalendarEvent,
  type CalendarFilter,
  type CalendarDay,
  isHighImpact,
  addDaysIso,
} from "@/lib/calendar/events";
import {
  type EarningsEntry,
  daysUntilEarnings,
} from "@/lib/parsers/earningsCalendar.shared";
import type { EconomicEvent } from "@/lib/parsers/economicCalendar.shared";
import { etTimeStringToCT, fmtWeekdayShortCT } from "@/lib/time";
import { usePrefersReducedMotion } from "@/lib/hooks/usePrefersReducedMotion";
import { RefreshEconomicButton } from "./RefreshEconomicButton";
import { RefreshMarketEarningsButton } from "./RefreshMarketEarningsButton";
import { SectorWeekStrip } from "./SectorWeekStrip";
import { EarningsRecap } from "./EarningsRecap";
import { SectorGroupAdd } from "./SectorGroupAdd";
import { useCalendarFilters } from "./useCalendarFilters";

type Props = {
  earnings: EarningsEntry[];
  economic: EconomicEvent[];
  refreshedAt?: string | null;
  sectorMap?: Map<string, string>;
  initialWatchlist?: string[];
};

export function CalendarView({
  earnings,
  economic,
  refreshedAt,
  sectorMap,
  initialWatchlist = [],
}: Props) {
  const {
    filter,
    setFilter,
    heldOnly,
    setHeldOnly,
    highImpactOnly,
    setHighImpactOnly,
    query,
    setQuery,
    today,
    days,
    upcoming,
  } = useCalendarFilters(earnings, economic);

  const [watchlist, setWatchlist] = useState<Set<string>>(
    () => new Set(initialWatchlist.map((s) => s.toUpperCase()))
  );
  async function addToWatchlist(symbol: string) {
    const sym = symbol.toUpperCase();
    if (watchlist.has(sym)) return;
    setWatchlist((prev) => new Set(prev).add(sym));
    try {
      await fetch("/api/watchlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbol: sym }),
      });
    } catch {
      /* swallow — optimistic UI already updated */
    }
  }
  async function removeFromWatchlist(symbol: string) {
    const sym = symbol.toUpperCase();
    if (!watchlist.has(sym)) return;
    setWatchlist((prev) => {
      const next = new Set(prev);
      next.delete(sym);
      return next;
    });
    try {
      await fetch(`/api/watchlist?symbol=${encodeURIComponent(sym)}`, {
        method: "DELETE",
      });
    } catch {
      /* swallow */
    }
  }
  async function toggleWatchlist(symbol: string) {
    const sym = symbol.toUpperCase();
    if (watchlist.has(sym)) await removeFromWatchlist(sym);
    else await addToWatchlist(sym);
  }

  return (
    <div className="space-y-4">
      <FilterRow
        filter={filter}
        onFilterChange={setFilter}
        heldOnly={heldOnly}
        onHeldOnlyChange={setHeldOnly}
        highImpactOnly={highImpactOnly}
        onHighImpactOnlyChange={setHighImpactOnly}
        query={query}
        onQueryChange={setQuery}
        refreshedAt={refreshedAt}
        upcoming={upcoming}
        days={days}
        earnings={earnings}
        sectorMap={sectorMap}
        watchlist={watchlist}
        onAddSymbol={addToWatchlist}
      />
      <div className="grid lg:grid-cols-2 gap-4">
        {sectorMap && sectorMap.size > 0 && (
          <SectorWeekStrip
            events={upcoming}
            sectorMap={sectorMap}
            fromIso={today}
            toIso={addDaysIso(today, 7)}
          />
        )}
        <EarningsRecap earnings={earnings} todayIso={today} />
      </div>
      <WeekStrip today={today} days={days} />
      <DayList
        days={days}
        today={today}
        sectorMap={sectorMap}
        watchlist={watchlist}
        onToggleWatchlist={toggleWatchlist}
      />
    </div>
  );
}

// ─────────────────────────── Filter row ───────────────────────────

function FilterRow({
  filter,
  onFilterChange,
  heldOnly,
  onHeldOnlyChange,
  highImpactOnly,
  onHighImpactOnlyChange,
  query,
  onQueryChange,
  refreshedAt,
  upcoming,
  days,
  earnings,
  sectorMap,
  watchlist,
  onAddSymbol,
}: {
  filter: CalendarFilter;
  onFilterChange: (v: CalendarFilter) => void;
  heldOnly: boolean;
  onHeldOnlyChange: (v: boolean) => void;
  highImpactOnly: boolean;
  onHighImpactOnlyChange: (v: boolean) => void;
  query: string;
  onQueryChange: (v: string) => void;
  refreshedAt?: string | null;
  upcoming: CalendarEvent[];
  days: CalendarDay[];
  earnings: EarningsEntry[];
  sectorMap?: Map<string, string>;
  watchlist: Set<string>;
  onAddSymbol: (symbol: string) => Promise<void>;
}) {
  const exportCsv = () => {
    const all: CalendarEvent[] = days.flatMap((d) => [
      ...d.earnings,
      ...d.economic,
    ]);
    const rows = [
      [
        "date",
        "kind",
        "symbol_or_event",
        "company",
        "type_or_time_ct",
        "eps_estimate_or_forecast",
        "actual_eps_or_previous",
        "importance_or_held",
      ].join(","),
      ...all.map((e) => csvRow(e)),
    ].join("\n");
    const blob = new Blob([rows], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `bull-calendar-${todayString()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <Card>
      <div className="flex flex-wrap items-center gap-3">
        <FilterToggle value={filter} onChange={onFilterChange} />
        <ToggleChip
          label="Held only"
          active={heldOnly}
          onClick={() => onHeldOnlyChange(!heldOnly)}
        />
        <ToggleChip
          label="High impact"
          active={highImpactOnly}
          onClick={() => onHighImpactOnlyChange(!highImpactOnly)}
        />
        <input
          type="search"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Search ticker or event…"
          aria-label="Search events"
          className="px-2.5 py-1.5 text-xs rounded border border-[var(--color-border)] bg-[var(--color-panel)] text-[var(--color-text)] placeholder:text-[var(--color-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)] min-w-[180px] grow max-w-[280px]"
        />
        <div className="flex items-center gap-2 ml-auto">
          <button
            type="button"
            onClick={exportCsv}
            className="px-2.5 py-1.5 text-xs rounded border border-[var(--color-border)] bg-[var(--color-panel)] text-[var(--color-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-panel-2)] transition-colors"
            aria-label="Export visible events as CSV"
          >
            Export CSV
          </button>
          <RefreshMarketEarningsButton />
          <RefreshEconomicButton refreshedAt={refreshedAt} />
        </div>
      </div>
      <div className="mt-3 pt-3 border-t border-[var(--color-border)] flex flex-wrap items-center gap-x-4 gap-y-2">
        {sectorMap && sectorMap.size > 0 && (
          <SectorGroupAdd
            earnings={earnings}
            sectorMap={sectorMap}
            watchlist={watchlist}
            onAddSymbol={onAddSymbol}
          />
        )}
        <div className="text-[11px] text-[var(--color-muted)] flex flex-wrap gap-x-3 gap-y-1 ml-auto">
          <span>{upcoming.length} upcoming (next 30 days)</span>
          {refreshedAt ? (
            <span>· last refreshed {refreshedAt.slice(0, 10)}</span>
          ) : null}
        </div>
      </div>
    </Card>
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
    <div
      role="tablist"
      aria-label="Event kind filter"
      className="inline-flex rounded-md border border-[var(--color-border)] overflow-hidden text-xs"
    >
      {options.map((o) => (
        <button
          key={o.v}
          type="button"
          role="tab"
          aria-selected={value === o.v}
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

function ToggleChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={clsx(
        "px-2.5 py-1.5 text-xs rounded border transition-colors",
        active
          ? "border-[var(--color-accent)] bg-[var(--color-panel-2)] text-[var(--color-text)]"
          : "border-[var(--color-border)] bg-[var(--color-panel)] text-[var(--color-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-panel-2)]"
      )}
    >
      {label}
    </button>
  );
}

// ─────────────────────────── Week strip ───────────────────────────

function WeekStrip({
  today,
  days,
}: {
  today: string;
  days: CalendarDay[];
}) {
  const reduceMotion = usePrefersReducedMotion();
  const stripRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!stripRef.current) return;
    const todayBtn = stripRef.current.querySelector<HTMLButtonElement>(
      `[data-iso="${today}"]`
    );
    if (todayBtn) {
      todayBtn.scrollIntoView({
        behavior: reduceMotion ? "auto" : "smooth",
        block: "nearest",
        inline: "center",
      });
    }
  }, [today, reduceMotion]);

  const scrollToDay = (iso: string) => {
    const el = document.getElementById(`day-${iso}`);
    if (el) {
      el.scrollIntoView({
        behavior: reduceMotion ? "auto" : "smooth",
        block: "start",
      });
    }
  };

  if (days.length === 0) return null;

  return (
    <Card>
      <div
        ref={stripRef}
        role="tablist"
        aria-label="Jump to day"
        className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-thin"
      >
        {days.map((d) => (
          <WeekStripCell
            key={d.date}
            day={d}
            isToday={d.date === today}
            onClick={() => scrollToDay(d.date)}
          />
        ))}
      </div>
    </Card>
  );
}

function WeekStripCell({
  day,
  isToday,
  onClick,
}: {
  day: CalendarDay;
  isToday: boolean;
  onClick: () => void;
}) {
  const m = day.date.match(/^\d{4}-\d{2}-(\d{2})$/);
  const dayNum = m ? Number(m[1]) : 0;
  const dow = fmtWeekdayShortCT(day.date);
  return (
    <button
      type="button"
      role="tab"
      aria-label={`Jump to ${day.date} (${day.total} events)`}
      data-iso={day.date}
      onClick={onClick}
      className={clsx(
        "shrink-0 min-w-[58px] flex flex-col items-center px-2 py-1.5 rounded border transition-colors",
        isToday
          ? "border-[var(--color-accent)] bg-[var(--color-panel-2)]"
          : "border-[var(--color-border)] bg-[var(--color-panel)] hover:bg-[var(--color-panel-2)]"
      )}
    >
      <span className="text-[10px] uppercase tracking-wider text-[var(--color-muted)]">
        {dow}
      </span>
      <span
        className={clsx(
          "text-base font-semibold tabular leading-tight",
          isToday ? "text-[var(--color-up)]" : "text-[var(--color-text)]"
        )}
      >
        {dayNum}
      </span>
      <span className="text-[10px] text-[var(--color-muted)]">
        {day.total > 0 ? `${day.total} evt` : "—"}
      </span>
    </button>
  );
}

// ─────────────────────────── Day list ───────────────────────────

function DayList({
  days,
  today,
  sectorMap,
  watchlist,
  onToggleWatchlist,
}: {
  days: CalendarDay[];
  today: string;
  sectorMap?: Map<string, string>;
  watchlist: Set<string>;
  onToggleWatchlist: (symbol: string) => void;
}) {
  if (days.length === 0) {
    return (
      <Card title="No events">
        <p className="text-xs text-[var(--color-muted)] py-2">
          No earnings or economic events match the current filters.
        </p>
      </Card>
    );
  }
  return (
    <div className="space-y-3">
      {days.map((d, idx) => (
        <DayCard
          key={d.date}
          day={d}
          today={today}
          sectorMap={sectorMap}
          watchlist={watchlist}
          onToggleWatchlist={onToggleWatchlist}
          // First 7 day-cards default open; older / further-out collapse to
          // reduce visual noise. User can toggle them open from the header.
          defaultOpen={idx < 7}
        />
      ))}
    </div>
  );
}

function DayCard({
  day,
  today,
  sectorMap,
  watchlist,
  onToggleWatchlist,
  defaultOpen,
}: {
  day: CalendarDay;
  today: string;
  sectorMap?: Map<string, string>;
  watchlist: Set<string>;
  onToggleWatchlist: (symbol: string) => void;
  defaultOpen: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const isToday = day.date === today;
  const isPast = day.date < today;
  const dow = fmtWeekdayShortCT(day.date);
  const m = day.date.match(/^\d{4}-(\d{2})-(\d{2})$/);
  const monthDay = m ? `${monthName(Number(m[1]))} ${Number(m[2])}` : day.date;

  const dayLabel = isToday
    ? `Today · ${dow}, ${monthDay}`
    : isPast
    ? `${dow}, ${monthDay}`
    : `${dow}, ${monthDay}`;

  return (
    <section id={`day-${day.date}`} className="frost rounded-2xl">
      <header
        className={clsx(
          "flex items-center justify-between gap-3 px-5 py-3 cursor-pointer select-none",
          open && "border-b border-[var(--color-border)]"
        )}
        onClick={() => setOpen(!open)}
        aria-expanded={open}
      >
        <div className="flex items-center gap-2 min-w-0">
          <h3
            className={clsx(
              "text-sm font-semibold tracking-tight",
              isToday ? "text-[var(--color-up)]" : "text-[var(--color-text)]"
            )}
          >
            {dayLabel}
          </h3>
          <span className="text-[10px] tabular text-[var(--color-muted)]">
            {day.date}
          </span>
        </div>
        <div className="flex items-center gap-2 text-[11px] text-[var(--color-muted)]">
          {day.earnings.length > 0 && (
            <span className="tabular">{day.earnings.length} earnings</span>
          )}
          {day.earnings.length > 0 && day.economic.length > 0 && <span>·</span>}
          {day.economic.length > 0 && (
            <span className="tabular">{day.economic.length} economic</span>
          )}
          <Chevron open={open} />
        </div>
      </header>
      {open && (
        <div className="px-5 py-4 space-y-4">
          {day.earnings.length > 0 && (
            <EarningsTable
              events={day.earnings}
              sectorMap={sectorMap}
              watchlist={watchlist}
              onToggleWatchlist={onToggleWatchlist}
            />
          )}
          {day.economic.length > 0 && <EconomicTable events={day.economic} />}
        </div>
      )}
    </section>
  );
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 12 12"
      className={clsx(
        "transition-transform text-[var(--color-muted)]",
        open && "rotate-180"
      )}
      aria-hidden
    >
      <path
        d="M2 4 L6 8 L10 4"
        stroke="currentColor"
        strokeWidth="1.5"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ─────────────────────────── Earnings table ───────────────────────────

function EarningsTable({
  events,
  sectorMap,
  watchlist,
  onToggleWatchlist,
}: {
  events: CalendarEvent[];
  sectorMap?: Map<string, string>;
  watchlist: Set<string>;
  onToggleWatchlist: (symbol: string) => void;
}) {
  return (
    <div>
      <h4 className="text-[11px] uppercase tracking-wider text-[var(--color-muted)] mb-1.5">
        Earnings
      </h4>
      <ul className="divide-y divide-[var(--color-border)]">
        {events.map((e, i) => {
          if (e.kind !== "earnings") return null;
          return (
            <li
              key={`${e.entry.symbol}-${i}`}
              className="py-2 grid grid-cols-[auto_1fr_auto_auto] sm:grid-cols-[auto_1fr_180px_120px_auto_auto] gap-x-3 gap-y-1 items-baseline text-sm"
            >
              <StarButton
                symbol={e.entry.symbol}
                starred={watchlist.has(e.entry.symbol.toUpperCase())}
                onToggle={onToggleWatchlist}
              />
              <div className="min-w-0 flex items-center gap-2">
                <Link
                  href={`https://finance.yahoo.com/quote/${encodeURIComponent(
                    e.entry.symbol
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold tabular text-[var(--color-text)] hover:text-[var(--color-accent)]"
                >
                  {e.entry.symbol}
                </Link>
                {e.entry.isHeld && (
                  <span
                    className="size-1.5 rounded-full bg-[var(--color-up)] shrink-0"
                    title="held position"
                    aria-label="held position"
                  />
                )}
                {e.entry.company && (
                  <span className="text-[var(--color-muted)] truncate">
                    {e.entry.company}
                  </span>
                )}
              </div>
              <div className="text-xs text-[var(--color-muted)] truncate hidden sm:block">
                {sectorMap?.get(e.entry.symbol.toUpperCase()) ?? ""}
              </div>
              <div className="text-xs text-[var(--color-muted)] tabular hidden sm:block">
                {e.entry.type ? <span>{e.entry.type}</span> : null}
                {e.entry.epsEstimate ? (
                  <span> · est {e.entry.epsEstimate}</span>
                ) : null}
              </div>
              <ResultCell entry={e.entry} />
              <DayBadge date={e.entry.date} />
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function StarButton({
  symbol,
  starred,
  onToggle,
}: {
  symbol: string;
  starred: boolean;
  onToggle: (s: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onToggle(symbol);
      }}
      aria-pressed={starred}
      aria-label={starred ? `Remove ${symbol} from watchlist` : `Add ${symbol} to watchlist`}
      className={clsx(
        "p-1 -m-1 rounded transition-colors",
        starred
          ? "text-[var(--color-warn)] hover:opacity-80"
          : "text-[var(--color-border)] hover:text-[var(--color-muted)]"
      )}
    >
      <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
        <path
          d="M7 1.5l1.7 3.5 3.8.55-2.75 2.7.65 3.8L7 10.25l-3.4 1.8.65-3.8L1.5 5.55l3.8-.55z"
          fill={starred ? "currentColor" : "none"}
          stroke="currentColor"
          strokeWidth="1"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}

function ResultCell({ entry }: { entry: EarningsEntry }) {
  if (!entry.actualEps && !entry.postPrintMovePct) {
    return <span className="text-xs text-[var(--color-muted)] hidden sm:block">—</span>;
  }
  const movePct = entry.postPrintMovePct?.replace(/[^\d.+-]/g, "");
  const moveNum = movePct ? Number(movePct) : NaN;
  const moveColor = !Number.isFinite(moveNum)
    ? "text-[var(--color-muted)]"
    : moveNum >= 0
    ? "text-[var(--color-up)]"
    : "text-[var(--color-down)]";
  return (
    <div className="text-xs hidden sm:flex items-baseline gap-1.5 tabular">
      {entry.actualEps && (
        <span className="text-[var(--color-text)]" title="actual EPS">
          {entry.actualEps}
        </span>
      )}
      {entry.postPrintMovePct && (
        <span className={moveColor} title="1-day post-print move">
          {entry.postPrintMovePct}
        </span>
      )}
    </div>
  );
}

function DayBadge({ date }: { date: string }) {
  const days = daysUntilEarnings(date);
  if (days == null || days < 0) return null;
  if (days === 0) return <Badge tone="down">today</Badge>;
  if (days <= 2) return <Badge tone="down">T-{days}</Badge>;
  if (days <= 5) return <Badge tone="warn">T-{days}</Badge>;
  return <Badge tone="neutral">T-{days}</Badge>;
}

// ─────────────────────────── Economic table ───────────────────────────

function EconomicTable({ events }: { events: CalendarEvent[] }) {
  return (
    <div>
      <h4 className="text-[11px] uppercase tracking-wider text-[var(--color-muted)] mb-1.5">
        Economic events
      </h4>
      <ul className="divide-y divide-[var(--color-border)]">
        {events.map((e, i) => {
          if (e.kind !== "economic") return null;
          const high = isHighImpact(e);
          return (
            <li
              key={`${e.entry.event}-${i}`}
              className="py-2 grid grid-cols-[60px_1fr_auto] sm:grid-cols-[80px_1fr_auto_auto_auto] gap-x-3 items-baseline text-sm"
            >
              <span className="text-xs tabular text-[var(--color-muted)]">
                {e.entry.time
                  ? `${etTimeStringToCT(e.entry.time, e.entry.date)} CT`
                  : "—"}
              </span>
              <span className="text-[var(--color-text)] truncate flex items-center gap-2">
                {high && (
                  <span
                    className="size-1.5 rounded-full bg-[var(--color-warn)] shrink-0"
                    aria-label="high impact"
                    title="high impact"
                  />
                )}
                {e.entry.event}
              </span>
              <span className="text-xs text-[var(--color-muted)] hidden sm:block">
                {e.entry.importance || ""}
              </span>
              <span className="text-xs tabular text-[var(--color-muted)] hidden sm:block">
                {e.entry.forecast ? `fcst ${e.entry.forecast}` : ""}
              </span>
              <span className="text-xs tabular text-[var(--color-muted)]">
                {e.entry.previous ? `prev ${e.entry.previous}` : ""}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// ─────────────────────────── Helpers ───────────────────────────

function monthName(monthIdx1Based: number): string {
  return [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ][monthIdx1Based - 1] ?? `M${monthIdx1Based}`;
}

function todayString(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function csvEscape(s: string): string {
  if (s == null) return "";
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function csvRow(e: CalendarEvent): string {
  if (e.kind === "earnings") {
    return [
      e.date,
      "earnings",
      e.entry.symbol,
      e.entry.company ?? "",
      e.entry.type,
      e.entry.epsEstimate ?? "",
      e.entry.actualEps ?? "",
      e.entry.isHeld ? "held" : "",
    ]
      .map((s) => csvEscape(String(s)))
      .join(",");
  }
  return [
    e.date,
    "economic",
    e.entry.event,
    "",
    e.entry.time,
    e.entry.forecast ?? "",
    e.entry.previous ?? "",
    e.entry.importance ?? "",
  ]
    .map((s) => csvEscape(String(s)))
    .join(",");
}
