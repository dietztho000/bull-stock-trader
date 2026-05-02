"use client";

import { useCallback, useEffect, useState } from "react";
import type {
  Breakpoint,
  LayoutItem,
  ResponsiveLayouts,
} from "react-grid-layout/legacy";

const STORAGE_VERSION = "v2";
const storageKey = (pageId: string) => `bst:layout:${STORAGE_VERSION}:${pageId}`;

type StoredLayout = {
  layouts: ResponsiveLayouts;
  hidden: string[];
};

function readStored(pageId: string): StoredLayout | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(storageKey(pageId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredLayout;
    if (!parsed || typeof parsed !== "object" || !parsed.layouts) return null;
    return {
      layouts: parsed.layouts,
      hidden: Array.isArray(parsed.hidden) ? parsed.hidden : [],
    };
  } catch {
    return null;
  }
}

function writeStored(pageId: string, value: StoredLayout) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(storageKey(pageId), JSON.stringify(value));
  } catch {
    // quota / private mode — silently ignore
  }
}

function clearStored(pageId: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(storageKey(pageId));
  } catch {
    // ignore
  }
}

export function useGridLayout(pageId: string, defaultLayouts: ResponsiveLayouts) {
  // Always start with defaults on the server and on the first client render
  // so SSR hydration matches. Saved state is loaded after mount.
  const [layouts, setLayoutsState] = useState<ResponsiveLayouts>(defaultLayouts);
  const [hiddenTileIds, setHiddenTileIds] = useState<Set<string>>(new Set());
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const stored = readStored(pageId);
    if (stored) {
      // Merge any default tile IDs that aren't in the stored layout (e.g.
      // tiles added in a release after the user customized their layout).
      // Append missing tiles at the bottom of each breakpoint instead of
      // dropping them silently.
      const merged: ResponsiveLayouts = { ...stored.layouts };
      for (const bp of Object.keys(defaultLayouts) as Breakpoint[]) {
        const current = merged[bp] ?? [];
        const have = new Set(current.map((l: LayoutItem) => l.i));
        const missing = (defaultLayouts[bp] ?? []).filter(
          (l: LayoutItem) => !have.has(l.i)
        );
        if (missing.length > 0) {
          const maxY = current.reduce(
            (m, l: LayoutItem) => Math.max(m, l.y + l.h),
            0
          );
          merged[bp] = [
            ...current,
            ...missing.map((l: LayoutItem) => ({ ...l, y: maxY })),
          ];
        }
      }
      setLayoutsState(merged);
      setHiddenTileIds(new Set(stored.hidden));
    }
    setHydrated(true);
  }, [pageId, defaultLayouts]);

  const persist = useCallback(
    (next: { layouts?: ResponsiveLayouts; hidden?: Set<string> }) => {
      const finalLayouts = next.layouts ?? layouts;
      const finalHidden = next.hidden ?? hiddenTileIds;
      writeStored(pageId, {
        layouts: finalLayouts,
        hidden: Array.from(finalHidden),
      });
    },
    [pageId, layouts, hiddenTileIds]
  );

  const setLayouts = useCallback(
    (next: ResponsiveLayouts) => {
      setLayoutsState(next);
      persist({ layouts: next });
    },
    [persist]
  );

  const toggleTileVisibility = useCallback(
    (tileId: string) => {
      setHiddenTileIds((prev) => {
        const next = new Set(prev);
        if (next.has(tileId)) next.delete(tileId);
        else next.add(tileId);
        persist({ hidden: next });
        return next;
      });
    },
    [persist]
  );

  const reset = useCallback(() => {
    clearStored(pageId);
    setLayoutsState(defaultLayouts);
    setHiddenTileIds(new Set());
  }, [pageId, defaultLayouts]);

  const isCustom = hydrated && readStored(pageId) !== null;

  return {
    layouts,
    setLayouts,
    hiddenTileIds,
    toggleTileVisibility,
    reset,
    hydrated,
    isCustom,
  };
}
