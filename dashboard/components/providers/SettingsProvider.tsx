"use client";

import { createContext, useContext, type ReactNode } from "react";
import { useDashboardSettings, type ClientSettings } from "@/lib/useSettings";
import type { RedactedSettings } from "@/lib/settings.schema";

type Ctx = {
  settings: ClientSettings;
  redacted: RedactedSettings | null;
  isLoading: boolean;
  refresh: () => Promise<unknown>;
};

const SettingsContext = createContext<Ctx | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const { settings, redacted, isLoading, mutate } = useDashboardSettings();
  return (
    <SettingsContext.Provider
      value={{ settings, redacted, isLoading, refresh: mutate }}
    >
      {children}
    </SettingsContext.Provider>
  );
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
