"use client";

// NEW 2026-05-06: matchMedia wrapper for `prefers-reduced-motion`. The
// 2026-05-04 dashboard audit flagged the absence of this hook; the
// week-strip auto-scroll on /calendar was the first feature to need it.
//
// SSR-safe: returns `false` on the server (the conservative answer — the
// page may animate briefly on first paint, then settle if reduced-motion
// is requested). This matches the React hydration contract.

import { useEffect, useState } from "react";

export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const handler = (e: MediaQueryListEvent) => setReduced(e.matches);
    if (mq.addEventListener) mq.addEventListener("change", handler);
    else mq.addListener(handler);
    return () => {
      if (mq.removeEventListener) mq.removeEventListener("change", handler);
      else mq.removeListener(handler);
    };
  }, []);

  return reduced;
}
