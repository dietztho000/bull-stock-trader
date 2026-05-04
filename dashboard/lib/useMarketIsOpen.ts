"use client";

import useSWR from "swr";
import { useTradingAccountOptional } from "@/lib/tradingAccountContext";
import { alpacaApiUrl } from "@/lib/alpacaMode";
import {
  type AlpacaClock,
  type AlpacaErrorEnvelope,
  isAlpacaError,
} from "@/lib/types/alpaca";

const fetcher = (u: string) => fetch(u).then((r) => r.json());

/** Polls the Alpaca clock at a coarse 30s cadence and exposes
 *  `is_open`. Used by `useLiveSwr` to gate faster (5s) polls when the market
 *  is closed — avoids hammering Alpaca on weekends and overnight. */
export function useMarketIsOpen(): boolean | null {
  const ctx = useTradingAccountOptional();
  const accountId = ctx?.accountId ?? null;
  const mode = ctx?.account;
  const { data } = useSWR<AlpacaClock | AlpacaErrorEnvelope>(
    alpacaApiUrl("clock", accountId ? { accountId } : { mode }),
    fetcher,
    {
      refreshInterval: 30_000,
      revalidateOnFocus: false,
      keepPreviousData: true,
      dedupingInterval: 30_000,
    }
  );
  if (!data) return null;
  if (isAlpacaError(data)) return null;
  return Boolean(data.is_open);
}
