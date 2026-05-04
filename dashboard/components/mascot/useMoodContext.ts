"use client";

import useSWR from "swr";
import { useTradingAccountOptional } from "@/lib/tradingAccountContext";

export type MoodContext = {
  winStreak: number | null;
  spyPhasePct: number | null;
  phaseStart: string | null;
  startingEquity: number | null;
  /** Portfolio value at the start of the current trading week (Monday CT), or
   *  the last available row when this week has no data yet. Drives mascot's
   *  week-breaker detection (rule #14). Optional because tile-mode callers
   *  construct a partial MoodContext for the modal that doesn't need it. */
  weekStartPortfolio?: number | null;
  recentRows: Array<{ date: string; portfolio: number | null }>;
};

const fetcher = async (u: string): Promise<MoodContext> => {
  const r = await fetch(u, { cache: "no-store" });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
};

export function useMoodContext(): {
  data: MoodContext | null;
  loading: boolean;
} {
  const ctx = useTradingAccountOptional();
  const botId = ctx?.botId;
  const url = botId
    ? `/api/overview/mood-context?bot=${encodeURIComponent(botId)}`
    : "/api/overview/mood-context";
  const { data, isLoading } = useSWR<MoodContext>(url, fetcher, {
    refreshInterval: 60_000,
    revalidateOnFocus: true,
    keepPreviousData: true,
  });
  return { data: data ?? null, loading: isLoading };
}
