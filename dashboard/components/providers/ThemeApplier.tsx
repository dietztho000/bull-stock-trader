"use client";

import { useEffect } from "react";
import { useSettings } from "./SettingsProvider";

function resolveTheme(pref: "dark" | "light" | "auto"): "dark" | "light" {
  if (pref !== "auto") return pref;
  if (typeof window === "undefined") return "dark";
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

export function ThemeApplier() {
  const { settings } = useSettings();
  const pref = settings.display.theme;

  useEffect(() => {
    const apply = () => {
      const t = resolveTheme(pref);
      document.documentElement.dataset.theme = t;
    };
    apply();
    if (pref === "auto" && typeof window !== "undefined") {
      const mq = window.matchMedia("(prefers-color-scheme: light)");
      const handler = () => apply();
      mq.addEventListener("change", handler);
      return () => mq.removeEventListener("change", handler);
    }
  }, [pref]);

  return null;
}
