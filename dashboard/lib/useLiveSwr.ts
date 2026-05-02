"use client";

import { useSettingsOptional } from "@/components/providers/SettingsProvider";
import { DEFAULTS } from "@/lib/settings.schema";

export type LiveSwrOptions = {
  refreshInterval: number;
  revalidateOnFocus: boolean;
};

/**
 * Resolves SWR live-polling options from the user's Settings.
 * Components pass their own *natural* fallback (the literal they used to hardcode);
 * we override only when settings expose a different value.
 *
 * - `autoRefreshEnabled = false` zeroes the interval (polling off).
 * - `pollIntervalMs` overrides the fallback when the user has chosen one.
 * - `refreshOnFocus` toggles SWR's focus revalidation.
 */
export function useLiveSwr(fallbackIntervalMs: number): LiveSwrOptions {
  const ctx = useSettingsOptional();
  const live = ctx?.settings.live ?? DEFAULTS.live;
  const refreshInterval = live.autoRefreshEnabled
    ? live.pollIntervalMs ?? fallbackIntervalMs
    : 0;
  return {
    refreshInterval,
    revalidateOnFocus: live.refreshOnFocus,
  };
}
