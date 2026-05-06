"use client";

import useSWR from "swr";
import { alpacaApiUrl, type AlpacaMode } from "@/lib/alpacaMode";
import { useTradingAccountOptional } from "@/lib/tradingAccountContext";
import {
  type AlpacaClock,
  type AlpacaErrorEnvelope,
  isAlpacaError,
} from "@/lib/types/alpaca";

const fetcher = (u: string) => fetch(u).then((r) => r.json());

export type MarketClockResult = {
  /** Raw clock payload from Alpaca, or null on error / pending. */
  clock: AlpacaClock | null;
  /** Convenience flag — null while the first response is in flight so callers
   *  can distinguish "not loaded yet" from "definitely closed." */
  isOpen: boolean | null;
};

/** Single SWR-backed Alpaca `/clock` poll. SWR dedupes by URL key, so multiple
 *  components reading from the same trading account context share one network
 *  request — `MarketClock`, `useMarketIsOpen` (gates faster polls when the
 *  market is closed), and `LiveConfirmDialog` (warns when switching live mid-
 *  session) all hit a single in-flight request per ~30s window.
 *
 *  Pass `mode`/`accountId` to scope the poll to a specific account regardless
 *  of the active trading-account context — used by `LiveConfirmDialog`, which
 *  must reflect the *current* account's market state during a pending switch.
 */
export function useMarketClock(opts?: {
  mode?: AlpacaMode;
  accountId?: string | null;
}): MarketClockResult {
  const ctx = useTradingAccountOptional();
  const accountId = opts?.accountId ?? ctx?.accountId ?? null;
  const mode = opts?.mode ?? ctx?.account;
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
  if (!data || isAlpacaError(data)) return { clock: null, isOpen: null };
  return { clock: data, isOpen: Boolean(data.is_open) };
}
