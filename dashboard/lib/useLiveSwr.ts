"use client";

import { useSettingsOptional } from "@/components/providers/SettingsProvider";
import { DEFAULTS } from "@/lib/settings.schema";
import { useMarketIsOpen } from "./useMarketIsOpen";

export type LiveSwrOptions = {
  refreshInterval: number;
  revalidateOnFocus: boolean;
};

/** When the market is closed, dashboards still update on focus & manual
 *  refresh, but background polling slows to one tick per minute (vs the
 *  user's chosen ms cadence). Saves a lot of Alpaca calls overnight. */
const MARKET_CLOSED_INTERVAL_MS = 60_000;

/**
 * Resolves SWR live-polling options from the user's Settings.
 * Components pass their own *natural* fallback (the literal they used to hardcode);
 * we override only when settings expose a different value.
 *
 * - `autoRefreshEnabled = false` zeroes the interval (polling off).
 * - `pollIntervalMs` overrides the fallback when the user has chosen one.
 * - `refreshOnFocus` toggles SWR's focus revalidation.
 * - When the Alpaca clock reports the market closed, the interval is clamped
 *   to `MARKET_CLOSED_INTERVAL_MS` to avoid weekend/overnight chatter.
 */
export function useLiveSwr(fallbackIntervalMs: number): LiveSwrOptions {
  const ctx = useSettingsOptional();
  const live = ctx?.settings.live ?? DEFAULTS.live;
  const marketOpen = useMarketIsOpen();
  let refreshInterval = live.autoRefreshEnabled
    ? live.pollIntervalMs ?? fallbackIntervalMs
    : 0;
  if (marketOpen === false && refreshInterval > 0) {
    refreshInterval = Math.max(refreshInterval, MARKET_CLOSED_INTERVAL_MS);
  }
  return {
    refreshInterval,
    revalidateOnFocus: live.refreshOnFocus,
  };
}
