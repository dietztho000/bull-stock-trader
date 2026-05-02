"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSettings } from "./SettingsProvider";

const LANDING_DONE_KEY = "bullStockTrader.landingRedirected";

const PATHS: Record<string, string> = {
  overview: "/",
  trades: "/trades",
  calendar: "/calendar",
  journal: "/journal",
  analytics: "/analytics",
  strategy: "/strategy",
};

/** One-shot session-scoped redirect to the user's chosen default landing page.
 *  Mount only on the overview page (`/`). After the first redirect within a
 *  session, navigations to `/` won't be intercepted again. */
export function LandingRedirect() {
  const router = useRouter();
  const { settings } = useSettings();
  const target = settings.display.defaultLandingPage;

  useEffect(() => {
    if (target === "overview") return;
    let done: string | null = null;
    try {
      done = window.sessionStorage.getItem(LANDING_DONE_KEY);
    } catch {
      done = null;
    }
    if (done === "1") return;
    try {
      window.sessionStorage.setItem(LANDING_DONE_KEY, "1");
    } catch {
      // ignore
    }
    const path = PATHS[target] ?? "/";
    if (path !== "/") router.replace(path);
  }, [router, target]);

  return null;
}
