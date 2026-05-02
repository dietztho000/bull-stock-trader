"use client";

import useSWR from "swr";
import { alpacaApiUrl, type AlpacaMode } from "@/lib/alpacaMode";
import { useTradingAccountOptional } from "@/lib/tradingAccountContext";
import { useLiveSwr } from "@/lib/useLiveSwr";

const fetcher = (u: string) => fetch(u).then((r) => r.json());

type AccountResponse = {
  equity: string;
  last_equity: string;
  cash: string;
  buying_power: string;
  daytrade_count: number;
  portfolio_value: string;
};

export type AccountSummary =
  | { loading: true }
  | { loading: false; error: string }
  | {
      loading: false;
      mode?: AlpacaMode;
      equity: number;
      dayPnl: number;
      dayPct: number;
      cash: number;
      cashPct: number;
      deployed: number;
      buyingPower: number;
      dayTradeCount: number;
    };

/**
 * Shared 5s-polled Alpaca account snapshot. SWR dedupes by URL, so multiple
 * KPI tiles all calling this hook share a single network request.
 *
 * When `mode` is omitted, falls back to the global TradingAccountContext —
 * client-only callers can stay decoupled from prop drilling. SSR-driven
 * callers (which know mode at render time) should still pass it explicitly.
 */
export function useAccountSummary(mode?: AlpacaMode): AccountSummary {
  const ctx = useTradingAccountOptional();
  const effectiveMode: AlpacaMode | undefined = mode ?? ctx?.account;
  const liveOpts = useLiveSwr(5000);
  const { data, error } = useSWR<AccountResponse | { error: string }>(
    alpacaApiUrl("account", effectiveMode),
    fetcher,
    { ...liveOpts, keepPreviousData: true }
  );

  if (error || (data && "error" in data)) {
    const msg =
      error?.message ??
      (data as { error: string } | undefined)?.error ??
      "failed to load";
    return { loading: false, error: msg };
  }
  if (!data) return { loading: true };

  const a = data as AccountResponse;
  const equity = Number(a.equity);
  const lastEquity = Number(a.last_equity);
  const cash = Number(a.cash);
  const dayPnl = equity - lastEquity;
  const dayPct = lastEquity > 0 ? (dayPnl / lastEquity) * 100 : 0;
  const cashPct = equity > 0 ? (cash / equity) * 100 : 0;

  return {
    loading: false,
    mode: effectiveMode,
    equity,
    dayPnl,
    dayPct,
    cash,
    cashPct,
    deployed: 100 - cashPct,
    buyingPower: Number(a.buying_power),
    dayTradeCount: a.daytrade_count,
  };
}
