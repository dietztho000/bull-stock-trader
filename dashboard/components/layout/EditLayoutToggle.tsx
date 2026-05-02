"use client";

import clsx from "clsx";
import { useLayoutContext } from "./LayoutEditContext";
import { TileVisibilityPopover } from "./TileVisibilityPopover";

export function EditLayoutToggle({ className }: { className?: string }) {
  const { editing, toggleEditing, reset, isCustom } = useLayoutContext();

  if (!editing) {
    return (
      <button
        type="button"
        onClick={toggleEditing}
        className={clsx(
          "glass glass-interactive inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium",
          isCustom && "glass-tint-accent",
          className
        )}
        title={isCustom ? "Layout customized — click to edit" : "Customize layout"}
      >
        <DragIcon />
        <span>{isCustom ? "Customized" : "Edit Layout"}</span>
      </button>
    );
  }

  return (
    <div className={clsx("inline-flex items-center gap-1.5", className)}>
      <TileVisibilityPopover />
      <button
        type="button"
        onClick={() => {
          if (
            isCustom &&
            !confirm("Reset this page's layout to defaults?")
          )
            return;
          reset();
        }}
        className="glass glass-interactive inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium"
        title="Reset to default layout"
      >
        <ResetIcon />
        <span>Reset</span>
      </button>
      <button
        type="button"
        onClick={toggleEditing}
        className="glass glass-interactive glass-tint-accent inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium"
      >
        <CheckIcon />
        <span>Done</span>
      </button>
    </div>
  );
}

function DragIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
      <circle cx="5" cy="3" r="1.2" />
      <circle cx="11" cy="3" r="1.2" />
      <circle cx="5" cy="8" r="1.2" />
      <circle cx="11" cy="8" r="1.2" />
      <circle cx="5" cy="13" r="1.2" />
      <circle cx="11" cy="13" r="1.2" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 8.5l3.5 3.5L13 4.5" />
    </svg>
  );
}

function ResetIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 8a5 5 0 1 1 1.5 3.6" />
      <path d="M3 4v3.5h3.5" />
    </svg>
  );
}
