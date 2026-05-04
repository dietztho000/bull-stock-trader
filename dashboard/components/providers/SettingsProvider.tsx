"use client";

import { createContext, useContext, useEffect, useMemo, type ReactNode } from "react";
import { useDashboardSettings, type ClientSettings } from "@/lib/useSettings";
import type {
  Bot,
  RedactedAccount,
  RedactedSettings,
} from "@/lib/settings.schema";

type Ctx = {
  settings: ClientSettings;
  redacted: RedactedSettings | null;
  /** Bot registry — exposed here so the global TradingAccountProvider and
   *  AccountSelector don't each issue their own /api/bots fetch on every
   *  layout mount (audit P5). Empty array while the first /api/settings
   *  response is in flight. */
  bots: Bot[];
  /** Account registry — same rationale as `bots`. */
  accounts: RedactedAccount[];
  isLoading: boolean;
  refresh: () => Promise<unknown>;
};

const SettingsContext = createContext<Ctx | null>(null);

type SsePayload = {
  events?: Array<{ file?: string }>;
};

export function SettingsProvider({ children }: { children: ReactNode }) {
  const { settings, redacted, isLoading, mutate } = useDashboardSettings();

  // SSE-driven instant refresh for dashboard-settings.json edits — replaces
  // the previous 60s SWR poll (audit H3). The poll still runs at 10min as a
  // safety net for missed events / disconnected tabs.
  useEffect(() => {
    const es = new EventSource("/api/stream");
    es.onmessage = (msg) => {
      try {
        const payload = JSON.parse(msg.data) as SsePayload;
        const touchedSettings = (payload.events ?? []).some(
          (e) => e.file === "dashboard-settings.json"
        );
        if (touchedSettings) void mutate();
      } catch {
        // heartbeat / malformed — ignore
      }
    };
    return () => es.close();
  }, [mutate]);

  const value = useMemo<Ctx>(
    () => ({
      settings,
      redacted,
      bots: redacted?.bots ?? [],
      accounts: redacted?.accounts ?? [],
      isLoading,
      refresh: mutate,
    }),
    [settings, redacted, isLoading, mutate]
  );
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): Ctx {
  const ctx = useContext(SettingsContext);
  if (!ctx) {
    throw new Error("useSettings must be used inside <SettingsProvider>");
  }
  return ctx;
}

export function useSettingsOptional(): Ctx | null {
  return useContext(SettingsContext);
}
