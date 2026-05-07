"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  type CalendarEvent,
  type CalendarFilter,
  type CalendarDay,
  mergeEvents,
  filterEvents,
  eventsByDate,
  groupByDate,
  isoToday,
  addDaysIso,
  isHighImpact,
} from "@/lib/calendar/events";
import type { EarningsEntry } from "@/lib/parsers/earningsCalendar.shared";
import type { EconomicEvent } from "@/lib/parsers/economicCalendar.shared";

export type CalendarFiltersState = {
  filter: CalendarFilter;
  setFilter: (next: CalendarFilter) => void;
  heldOnly: boolean;
  setHeldOnly: (next: boolean) => void;
  highImpactOnly: boolean;
  setHighImpactOnly: (next: boolean) => void;
  query: string;
  setQuery: (next: string) => void;
  today: string;
  cursor: string;
  setCursor: (next: string) => void;
  selected: string | null;
  setSelected: (next: string | null) => void;
  filtered: CalendarEvent[];
  byDate: Map<string, CalendarEvent[]>;
  selectedEvents: CalendarEvent[];
  upcoming: CalendarEvent[];
  // REVAMPED 2026-05-06: day-grouped slice for the new agenda layout. Spans
  // 2 days back (so post-print results are visible) through 30 days forward.
  days: CalendarDay[];
  focusSymbol: string | null;
};

/** Owns calendar filter, cursor (visible month), and selection — including
 *  the `?focus=TICKER` deep link behavior, the "default-select today"
 *  effect, the held-only / high-impact-only toggles, and the inline ticker
 *  search box. Extracted from `CalendarView` so the view file stays
 *  focused on rendering. */
export function useCalendarFilters(
  earnings: EarningsEntry[],
  economic: EconomicEvent[]
): CalendarFiltersState {
  const searchParams = useSearchParams();
  const focusSymbol = searchParams.get("focus")?.toUpperCase() ?? null;
  const [filter, setFilter] = useState<CalendarFilter>("all");
  const [heldOnly, setHeldOnly] = useState(false);
  const [highImpactOnly, setHighImpactOnly] = useState(false);
  const [query, setQuery] = useState("");
  const today = useMemo(() => isoToday(), []);
  const [cursor, setCursor] = useState(() => isoFirstOfMonthInternal(today));
  const [selected, setSelected] = useState<string | null>(null);

  const allEvents = useMemo(
    () => mergeEvents(earnings, economic),
    [earnings, economic]
  );
  const filtered = useMemo(() => {
    let out = filterEvents(allEvents, filter);
    if (heldOnly) {
      out = out.filter((e) => e.kind === "earnings" && e.entry.isHeld);
    }
    if (highImpactOnly) {
      out = out.filter(isHighImpact);
    }
    const q = query.trim().toLowerCase();
    if (q) {
      out = out.filter((e) => {
        if (e.kind === "earnings") {
          return (
            e.entry.symbol.toLowerCase().includes(q) ||
            (e.entry.company ?? "").toLowerCase().includes(q)
          );
        }
        return e.entry.event.toLowerCase().includes(q);
      });
    }
    return out;
  }, [allEvents, filter, heldOnly, highImpactOnly, query]);
  const byDate = useMemo(() => eventsByDate(filtered), [filtered]);

  const days = useMemo(() => {
    const from = addDaysIso(today, -2);
    const to = addDaysIso(today, 30);
    return groupByDate(filtered, { from, to });
  }, [filtered, today]);

  useEffect(() => {
    if (!focusSymbol) return;
    const match = earnings.find(
      (e) => e.symbol.toUpperCase() === focusSymbol && e.date >= today
    );
    if (match) {
      setSelected(match.date);
      setCursor(isoFirstOfMonthInternal(match.date));
    }
  }, [focusSymbol, earnings, today]);

  useEffect(() => {
    if (selected) return;
    if (focusSymbol) return;
    if (byDate.has(today)) {
      setSelected(today);
      return;
    }
    const next = filtered.find((e) => e.date >= today);
    if (next) setSelected(next.date);
  }, [byDate, filtered, selected, today, focusSymbol]);

  const selectedEvents = selected ? byDate.get(selected) ?? [] : [];

  const upcoming = useMemo(() => {
    const horizon = addDaysIso(today, 30);
    return filtered
      .filter((e) => e.date >= today && e.date <= horizon)
      .slice(0, 60);
  }, [filtered, today]);

  return {
    filter,
    setFilter,
    heldOnly,
    setHeldOnly,
    highImpactOnly,
    setHighImpactOnly,
    query,
    setQuery,
    today,
    cursor,
    setCursor,
    selected,
    setSelected,
    filtered,
    byDate,
    selectedEvents,
    upcoming,
    days,
    focusSymbol,
  };
}

function isoFirstOfMonthInternal(iso: string): string {
  const m = iso.match(/^(\d{4})-(\d{2})/);
  return m ? `${m[1]}-${m[2]}-01` : iso;
}
