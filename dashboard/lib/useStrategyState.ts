"use client";

import useSWR from "swr";
import { useTradingAccountOptional } from "@/lib/tradingAccountContext";

/** Mirrors the server-side `StrategyState` shape. We re-declare it client-side
 *  to keep the import graph clean (the server file is `server-only`). */
export type StrategyState = {
  date: string;
  sectorsAtCap: string[];
  blockedSectors: string[];
  cooldownSymbols: Array<{
    symbol: string;
    daysRemaining: number;
    lastLossDate: string;
  }>;
  earningsT2Held: Array<{
    symbol: string;
    daysUntil: number;
    type: "BMO" | "AMC" | "";
  }>;
  blockedIdeas: Array<{
    symbol: string;
    sector: string;
    reason: "sector-cap" | "cooldown" | "earnings-gate";
    detail: string;
  }>;
  slotsUsed: number;
  slotsCap: number;
  dayBreakerActive?: boolean;
  weekBreakerActive?: boolean;
  dayPnlPct?: number | null;
  weekPnlPct?: number | null;
};

const fetcher = async (u: string): Promise<StrategyState> => {
  const r = await fetch(u, { cache: "no-store" });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
};

/** Reads strategy state for the active bot context. Pulls `botId` from the
 *  TradingAccountContext so a switch in the AccountSelector dropdown
 *  immediately re-keys the cooldown / earnings-T2 / sector-cap data — the
 *  alert watcher, mascot flavor, and OrderEntryTile rule-blocker all
 *  consume this. Without the bot scope the route silently fell back to
 *  `BOT_MODE` env (audit C5). */
export function useStrategyState(): {
  data: StrategyState | null;
  loading: boolean;
  error: Error | null;
} {
  const ctx = useTradingAccountOptional();
  const botId = ctx?.botId;
  const url = botId
    ? `/api/overview/strategy-state?bot=${encodeURIComponent(botId)}`
    : "/api/overview/strategy-state";
  const { data, error, isLoading } = useSWR<StrategyState>(url, fetcher, {
    // Strategy state changes on the order of minutes (research log,
    // sector ledger), not seconds. Don't pile on top of 5s Alpaca polls.
    refreshInterval: 60_000,
    revalidateOnFocus: true,
    keepPreviousData: true,
  });
  return {
    data: data ?? null,
    loading: isLoading,
    error: (error as Error) ?? null,
  };
}
