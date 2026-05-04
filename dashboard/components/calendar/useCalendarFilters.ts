"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  type CalendarEvent,
  type CalendarFilter,
  mergeEvents,
  filterEvents,
  eventsByDate,
  isoToday,
  addDaysIso,
} from "@/lib/calendar/events";
import type { EarningsEntry } from "@/lib/parsers/earningsCalendar.shared";
import type { EconomicEvent } from "@/lib/parsers/economicCalendar.shared";

export type CalendarFiltersState = {
  filter: CalendarFilter;
  setFilter: (next: CalendarFilter) => void;
  today: string;
  cursor: string;
  setCursor: (next: string) => void;
  selected: string | null;
  setSelected: (next: string | null) => void;
  filtered: CalendarEvent[];
  byDate: Map<string, CalendarEvent[]>;
  selectedEvents: CalendarEvent[];
  upcoming: CalendarEvent[];
  focusSymbol: string | null;
};

/** Owns calendar filter, cursor (visible month), and selection — including
 *  the `?focus=TICKER` deep link behavior and the "default-select today"
 *  effect. Extracted from `CalendarView` so the view file can stay focused on
 *  rendering. */
export function useCalendarFilters(
  earnings: EarningsEntry[],
  economic: EconomicEvent[]
): CalendarFiltersState {
  const searchParams = useSearchParams();
  const focusSymbol = searchParams.get("focus")?.toUpperCase() ?? null;
  const [filter, setFilter] = useState<CalendarFilter>("all");
  const today = useMemo(() => isoToday(), []);
  const [cursor, setCursor] = useState(() => isoFirstOfMonthInternal(today));
  const [selected, setSelected] = useState<string | null>(null);

  const allEvents = useMemo(
    () => mergeEvents(earnings, economic),
    [earnings, economic]
  );
  const filtered = useMemo(
    () => filterEvents(allEvents, filter),
    [allEvents, filter]
  );
  const byDate = useMemo(() => eventsByDate(filtered), [filtered]);

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
    today,
    cursor,
    setCursor,
    selected,
    setSelected,
    filtered,
    byDate,
    selectedEvents,
    upcoming,
    focusSymbol,
  };
}

function isoFirstOfMonthInternal(iso: string): string {
  const m = iso.match(/^(\d{4})-(\d{2})/);
  return m ? `${m[1]}-${m[2]}-01` : iso;
}
