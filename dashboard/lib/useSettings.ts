"use client";

import useSWR from "swr";
import {
  DEFAULTS,
  type DashboardSettings,
  type RedactedSettings,
} from "@/lib/settings.schema";

const fetcher = async (url: string) => {
  const r = await fetch(url, { cache: "no-store" });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return (await r.json()) as RedactedSettings;
};

export type ClientSettings = Pick<
  DashboardSettings,
  "display" | "live" | "defaults" | "notifications" | "mascot" | "strategy" | "alerts"
>;

export function useDashboardSettings(): {
  settings: ClientSettings;
  redacted: RedactedSettings | null;
  isLoading: boolean;
  error: Error | null;
  mutate: () => Promise<unknown>;
} {
  // Settings rarely change. SettingsProvider drives instant updates via the
  // chokidar→SSE stream when dashboard-settings.json is touched; this poll
  // is just a safety net for missed events / disconnected tabs (audit H3).
  const { data, error, isLoading, mutate } = useSWR<RedactedSettings>(
    "/api/settings",
    fetcher,
    {
      refreshInterval: 600_000,
      revalidateOnFocus: true,
      keepPreviousData: true,
    }
  );

  const settings: ClientSettings = data
    ? {
        display: data.display,
        live: data.live,
        defaults: data.defaults,
        notifications: data.notifications,
        mascot: data.mascot,
        strategy: data.strategy,
        alerts: data.alerts,
      }
    : {
        display: DEFAULTS.display,
        live: DEFAULTS.live,
        defaults: DEFAULTS.defaults,
        notifications: DEFAULTS.notifications,
        mascot: DEFAULTS.mascot,
        strategy: DEFAULTS.strategy,
        alerts: DEFAULTS.alerts,
      };

  return {
    settings,
    redacted: data ?? null,
    isLoading,
    error: (error as Error) ?? null,
    mutate,
  };
}
