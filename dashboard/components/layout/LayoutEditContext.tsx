"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { ResponsiveLayouts } from "react-grid-layout/legacy";
import { useGridLayout } from "./useGridLayout";
import type { PageLayoutSpec } from "./defaults";

type LayoutContextValue = {
  pageId: string;
  spec: PageLayoutSpec;
  editing: boolean;
  setEditing: (next: boolean) => void;
  toggleEditing: () => void;
  layouts: ResponsiveLayouts;
  setLayouts: (next: ResponsiveLayouts) => void;
  hiddenTileIds: Set<string>;
  toggleTileVisibility: (tileId: string) => void;
  reset: () => void;
  hydrated: boolean;
  isCustom: boolean;
};

const LayoutContext = createContext<LayoutContextValue | null>(null);

export function LayoutProvider({
  pageId,
  spec,
  children,
}: {
  pageId: string;
  spec: PageLayoutSpec;
  children: ReactNode;
}) {
  const grid = useGridLayout(pageId, spec.defaults);
  const [editing, setEditing] = useState(false);
  const toggleEditing = useCallback(() => setEditing((v) => !v), []);

  const value = useMemo<LayoutContextValue>(
    () => ({
      pageId,
      spec,
      editing,
      setEditing,
      toggleEditing,
      ...grid,
    }),
    [pageId, spec, editing, toggleEditing, grid]
  );

  return <LayoutContext.Provider value={value}>{children}</LayoutContext.Provider>;
}

export function useLayoutContext(): LayoutContextValue {
  const ctx = useContext(LayoutContext);
  if (!ctx) {
    throw new Error(
      "useLayoutContext must be used inside <LayoutProvider> — wrap your page or section in it."
    );
  }
  return ctx;
}
