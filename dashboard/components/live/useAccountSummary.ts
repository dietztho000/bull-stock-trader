"use client";

import useSWR from "swr";
import { alpacaApiUrl, type AlpacaMode } from "@/lib/alpacaMode";
import { useTradingAccountOptional } from "@/lib/tradingAccountContext";
import { useLiveSwr } from "@/lib/useLiveSwr";
import {
  type AlpacaAccount,
  type AlpacaErrorEnvelope,
  isAlpacaError,
} from "@/lib/types/alpaca";

const fetcher = (u: string) => fetch(u).then((r) => r.json());

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
 * When `accountId`/`mode` are omitted, falls back to the global
 * TradingAccountContext — client-only callers can stay decoupled from prop
 * drilling. SSR-driven callers (which know identity at render time) should
 * still pass it explicitly. `accountId` wins over `mode` when both are set.
 */
export function useAccountSummary(
  modeOrOpts?: AlpacaMode | { mode?: AlpacaMode; accountId?: string | null }
): AccountSummary {
  const ctx = useTradingAccountOptional();
  const opts =
    typeof modeOrOpts === "string" || modeOrOpts === undefined
      ? { mode: modeOrOpts as AlpacaMode | undefined }
      : modeOrOpts;
  const effectiveAccountId: string | null = opts.accountId ?? ctx?.accountId ?? null;
  const effectiveMode: AlpacaMode | undefined = opts.mode ?? ctx?.account;
  const liveOpts = useLiveSwr(5000);
  const { data, error } = useSWR<AlpacaAccount | AlpacaErrorEnvelope>(
    alpacaApiUrl(
      "account",
      effectiveAccountId
        ? { accountId: effectiveAccountId }
        : { mode: effectiveMode }
    ),
    fetcher,
    { ...liveOpts, keepPreviousData: true }
  );

  if (error || (data && isAlpacaError(data))) {
    const msg =
      error?.message ??
      (data && isAlpacaError(data) ? data.error : undefined) ??
      "failed to load";
    return { loading: false, error: msg };
  }
  if (!data) return { loading: true };

  const a = data;
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
