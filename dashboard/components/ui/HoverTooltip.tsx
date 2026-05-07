// Lightweight hover/focus tooltip for surfacing structured data without a
// full popover library. Used on the Overview surface to replace native
// title= attributes that can't render JSX (UpcomingEventsCard rows, Latest
// Brief idea preview, mascot card labels). Reuse for any small inline
// "what does this mean?" hint.
//
// Scope of v1:
// - Hover (mouse) and focus (keyboard) trigger; no tap/long-press handling.
// - Fixed side ("top" or "bottom"); no auto-flip near viewport edges.
// - No animation — sidesteps prefers-reduced-motion and matches the rest of
//   the dashboard's restraint.
// - No portal — viewport overflow on narrow columns is acceptable for v1.
"use client";

import {
  cloneElement,
  isValidElement,
  useId,
  useState,
  type FocusEvent,
  type MouseEvent,
  type ReactElement,
  type ReactNode,
} from "react";
import clsx from "clsx";

type TriggerProps = {
  onMouseEnter?: (e: MouseEvent) => void;
  onMouseLeave?: (e: MouseEvent) => void;
  onFocus?: (e: FocusEvent) => void;
  onBlur?: (e: FocusEvent) => void;
  "aria-describedby"?: string;
};

export type HoverTooltipProps = {
  content: ReactNode;
  children: ReactElement<TriggerProps>;
  side?: "top" | "bottom";
  className?: string;
};

export function HoverTooltip({
  content,
  children,
  side = "top",
  className,
}: HoverTooltipProps) {
  const [open, setOpen] = useState(false);
  const tooltipId = useId();

  if (!isValidElement(children)) return children;

  const existing = children.props as TriggerProps;
  const trigger = cloneElement<TriggerProps>(children, {
    onMouseEnter: (e: MouseEvent) => {
      setOpen(true);
      existing.onMouseEnter?.(e);
    },
    onMouseLeave: (e: MouseEvent) => {
      setOpen(false);
      existing.onMouseLeave?.(e);
    },
    onFocus: (e: FocusEvent) => {
      setOpen(true);
      existing.onFocus?.(e);
    },
    onBlur: (e: FocusEvent) => {
      setOpen(false);
      existing.onBlur?.(e);
    },
    "aria-describedby": open ? tooltipId : existing["aria-describedby"],
  });

  return (
    <span className="relative inline-block">
      {trigger}
      {open && (
        <span
          role="tooltip"
          id={tooltipId}
          className={clsx(
            "absolute left-1/2 -translate-x-1/2 z-50",
            "max-w-[260px] min-w-[160px] w-max",
            "rounded border border-[var(--color-border)]",
            "bg-[var(--color-panel)]/95 backdrop-blur-sm",
            "p-2 text-[11px] leading-snug text-[var(--color-text)]",
            "shadow-lg pointer-events-none",
            side === "top" ? "bottom-full mb-1" : "top-full mt-1",
            className
          )}
        >
          {content}
        </span>
      )}
    </span>
  );
}
