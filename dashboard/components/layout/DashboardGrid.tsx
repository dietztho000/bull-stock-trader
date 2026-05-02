"use client";

import clsx from "clsx";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Responsive,
  WidthProvider,
  type Breakpoint,
  type LayoutItem,
  type ResponsiveLayouts,
} from "react-grid-layout/legacy";
import { useLayoutContext } from "./LayoutEditContext";

const ResponsiveGrid = WidthProvider(Responsive);

const BREAKPOINTS = { lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 };
const COLS = { lg: 12, md: 12, sm: 6, xs: 4, xxs: 2 };

type TilesMap = Record<string, ReactNode>;

export function DashboardGrid({
  tiles,
  className,
  rowHeight = 48,
}: {
  /** Map from tile id (must match defaults.ts) → server-rendered ReactNode. */
  tiles: TilesMap;
  className?: string;
  rowHeight?: number;
}) {
  const {
    spec,
    editing,
    layouts,
    setLayouts,
    hiddenTileIds,
    hydrated,
  } = useLayoutContext();

  // Render a static stack on the server / first client paint so SSR
  // hydration matches. The grid takes over after mount.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Filter the layouts to only include visible tiles. RGL ignores layout
  // entries whose `i` doesn't match a child key, but we still strip them
  // for cleanliness.
  const filteredLayouts = useMemo<ResponsiveLayouts>(() => {
    if (hiddenTileIds.size === 0) return layouts;
    const out: ResponsiveLayouts = {};
    for (const bp of Object.keys(layouts) as Breakpoint[]) {
      const arr = layouts[bp];
      if (!arr) continue;
      out[bp] = arr.filter((l: LayoutItem) => !hiddenTileIds.has(l.i));
    }
    return out;
  }, [layouts, hiddenTileIds]);

  const visibleTiles = spec.tiles.filter((t) => !hiddenTileIds.has(t.id));

  // SSR / pre-mount: stack tiles in default order without any grid chrome.
  // Matches the visual rhythm of the original space-y-5 pages.
  if (!mounted) {
    return (
      <div className={clsx("space-y-5", className)}>
        {visibleTiles.map((t) =>
          tiles[t.id] ? (
            <div key={t.id} data-tile-id={t.id}>
              {tiles[t.id]}
            </div>
          ) : null
        )}
      </div>
    );
  }

  return (
    <div className={clsx("dashboard-grid-wrap", editing && "is-editing", className)}>
      <ResponsiveGrid
        className="dashboard-grid"
        layouts={filteredLayouts}
        breakpoints={BREAKPOINTS}
        cols={COLS}
        rowHeight={rowHeight}
        margin={[16, 16]}
        containerPadding={[0, 0]}
        isDraggable={editing}
        isResizable={editing}
        // Touch-friendly: bigger handle, allow dragging from anywhere on the
        // tile body in edit mode (no draggableHandle restriction).
        useCSSTransforms={hydrated}
        compactType="vertical"
        preventCollision={false}
        draggableCancel="input,textarea,select,button,a,label,details,summary,.no-drag"
        onLayoutChange={(_current, all) => {
          if (!editing) return;
          // Merge: keep layouts for hidden tiles untouched, replace visible ones.
          const merged: ResponsiveLayouts = {};
          for (const bp of Object.keys(all) as Breakpoint[]) {
            const next = all[bp] ?? [];
            const prevHidden = (layouts[bp] ?? []).filter((l: LayoutItem) =>
              hiddenTileIds.has(l.i)
            );
            merged[bp] = [...next, ...prevHidden];
          }
          setLayouts(merged);
        }}
      >
        {visibleTiles.map((t) => {
          const node = tiles[t.id];
          if (!node) return null;
          return (
            <div
              key={t.id}
              data-tile-id={t.id}
              className={clsx(
                "dashboard-grid-item",
                editing && "is-editing"
              )}
            >
              {/* Inner scroll container so chart-heavy tiles never overflow
                  their grid cell when the user resizes them small. */}
              <div className="dashboard-grid-item-inner">{node}</div>
            </div>
          );
        })}
      </ResponsiveGrid>
    </div>
  );
}
