"use client";

import { useEffect, useRef, useState } from "react";
import { useLayoutContext } from "./LayoutEditContext";

export function TileVisibilityPopover() {
  const { spec, hiddenTileIds, toggleTileVisibility } = useLayoutContext();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const visibleCount = spec.tiles.length - hiddenTileIds.size;

  return (
    <div className="relative" ref={wrapRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="glass glass-interactive inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium"
        title="Show or hide individual tiles"
      >
        <TilesIcon />
        <span>
          Tiles{" "}
          <span className="text-[var(--color-muted)]">
            {visibleCount}/{spec.tiles.length}
          </span>
        </span>
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Tile visibility"
          className="absolute right-0 top-full mt-2 z-50 frost rounded-xl p-2 min-w-[220px] shadow-2xl"
        >
          <div className="text-[10px] uppercase tracking-[0.14em] text-[var(--color-muted)] px-2 pt-1.5 pb-1">
            Show tiles
          </div>
          <ul className="max-h-[60vh] overflow-y-auto">
            {spec.tiles.map((tile) => {
              const hidden = hiddenTileIds.has(tile.id);
              return (
                <li key={tile.id}>
                  <label className="flex items-center gap-2.5 px-2 py-1.5 rounded-md hover:bg-[rgba(255,255,255,0.04)] cursor-pointer text-sm">
                    <input
                      type="checkbox"
                      checked={!hidden}
                      onChange={() => toggleTileVisibility(tile.id)}
                      className="accent-[var(--color-accent)]"
                    />
                    <span className="text-[var(--color-text)]">{tile.title}</span>
                  </label>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

function TilesIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
      <rect x="2" y="2" width="5" height="5" rx="1" />
      <rect x="9" y="2" width="5" height="5" rx="1" />
      <rect x="2" y="9" width="5" height="5" rx="1" />
      <rect x="9" y="9" width="5" height="5" rx="1" />
    </svg>
  );
}
