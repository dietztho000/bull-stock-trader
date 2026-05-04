"use client";

import clsx from "clsx";
import { motion, LayoutGroup } from "framer-motion";
import { useCallback, useRef, type KeyboardEvent, type ReactNode } from "react";

type Tone = "neutral" | "accent" | "up" | "down" | "warn";

const tintClass: Record<Tone, string> = {
  neutral: "",
  accent: "glass-tint-accent",
  up: "glass-tint-up",
  down: "glass-tint-down",
  warn: "glass-tint-warn",
};

export function Glass({
  as: Tag = "div",
  className,
  variant = "regular",
  tone = "neutral",
  interactive = false,
  children,
  ...rest
}: {
  as?: "div" | "section" | "header" | "aside" | "nav";
  className?: string;
  variant?: "regular" | "strong";
  tone?: Tone;
  interactive?: boolean;
  children: ReactNode;
} & React.HTMLAttributes<HTMLElement>) {
  const Component = Tag as React.ElementType;
  return (
    <Component
      className={clsx(
        variant === "strong" ? "glass-strong" : "glass",
        tintClass[tone],
        interactive && "glass-interactive",
        className
      )}
      {...rest}
    >
      {children}
    </Component>
  );
}

export function GlassCapsule({
  className,
  tone = "neutral",
  interactive = false,
  children,
  layoutId,
  onClick,
  title,
  type = "button",
}: {
  className?: string;
  tone?: Tone;
  interactive?: boolean;
  children: ReactNode;
  layoutId?: string;
  onClick?: () => void;
  title?: string;
  type?: "button" | "submit";
}) {
  const cls = clsx(
    "glass",
    tintClass[tone],
    interactive && "glass-interactive",
    "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium tabular",
    className
  );
  if (onClick) {
    return (
      <motion.button
        type={type}
        layoutId={layoutId}
        className={cls}
        onClick={onClick}
        title={title}
      >
        {children}
      </motion.button>
    );
  }
  if (layoutId) {
    return (
      <motion.div layoutId={layoutId} className={cls} title={title}>
        {children}
      </motion.div>
    );
  }
  return (
    <span className={cls} title={title}>
      {children}
    </span>
  );
}

export function FrostedCard({
  className,
  title,
  subtitle,
  right,
  children,
  padding = "default",
}: {
  className?: string;
  title?: ReactNode;
  subtitle?: ReactNode;
  right?: ReactNode;
  children: ReactNode;
  padding?: "default" | "tight" | "none";
}) {
  const padCls = padding === "none" ? "" : padding === "tight" ? "p-3" : "p-5";
  return (
    <section className={clsx("frost rounded-2xl", padCls, className)}>
      {(title || right) && (
        <header className="flex items-start justify-between gap-3 mb-3">
          <div>
            {title && (
              <h2 className="text-[11px] font-semibold tracking-[0.12em] uppercase text-[var(--color-muted)]">
                {title}
              </h2>
            )}
            {subtitle && (
              <div className="text-xs text-[var(--color-muted)] mt-1">
                {subtitle}
              </div>
            )}
          </div>
          {right && <div className="shrink-0">{right}</div>}
        </header>
      )}
      {children}
    </section>
  );
}

export function SegmentedGlass<T extends string>({
  options,
  value,
  onChange,
  layoutId,
  className,
  ariaLabel,
}: {
  options: { value: T; label: ReactNode }[];
  value: T;
  onChange: (next: T) => void;
  layoutId: string;
  className?: string;
  ariaLabel?: string;
}) {
  // WAI-ARIA tablist roving tabindex (audit U10): only the active tab is in
  // the document's tab order; arrows move focus + activate, Home/End jump to
  // the ends. Tab/Shift-Tab moves to/from the tablist itself.
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const activeIndex = Math.max(
    0,
    options.findIndex((o) => o.value === value)
  );

  const focusAndActivate = useCallback(
    (idx: number) => {
      const next = options[idx];
      if (!next) return;
      tabRefs.current[idx]?.focus();
      if (next.value !== value) onChange(next.value);
    },
    [onChange, options, value]
  );

  const handleKey = useCallback(
    (e: KeyboardEvent<HTMLButtonElement>, idx: number) => {
      switch (e.key) {
        case "ArrowRight":
          e.preventDefault();
          focusAndActivate((idx + 1) % options.length);
          break;
        case "ArrowLeft":
          e.preventDefault();
          focusAndActivate((idx - 1 + options.length) % options.length);
          break;
        case "Home":
          e.preventDefault();
          focusAndActivate(0);
          break;
        case "End":
          e.preventDefault();
          focusAndActivate(options.length - 1);
          break;
        case "Enter":
        case " ":
          e.preventDefault();
          // Already focused — just commit (handles the "Tab to a non-active
          // tab and press Enter" path; default `onClick` covers click).
          if (options[idx].value !== value) onChange(options[idx].value);
          break;
        default:
          break;
      }
    },
    [focusAndActivate, onChange, options, value]
  );

  return (
    <LayoutGroup id={layoutId}>
      <div
        role="tablist"
        aria-label={ariaLabel}
        className={clsx(
          "glass inline-flex items-center gap-1 rounded-full p-1",
          className
        )}
      >
        {options.map((opt, idx) => {
          const active = opt.value === value;
          return (
            <button
              key={opt.value}
              ref={(el) => {
                tabRefs.current[idx] = el;
              }}
              type="button"
              role="tab"
              aria-selected={active}
              tabIndex={idx === activeIndex ? 0 : -1}
              onKeyDown={(e) => handleKey(e, idx)}
              onClick={() => onChange(opt.value)}
              className={clsx(
                "relative px-3.5 py-1.5 rounded-full text-xs font-medium transition-colors z-10",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-1",
                active
                  ? "text-[var(--color-text)]"
                  : "text-[var(--color-muted)] hover:text-[var(--color-text)]"
              )}
            >
              {active && (
                <motion.span
                  layoutId={`${layoutId}-active`}
                  className="absolute inset-0 rounded-full glass-tint-accent"
                  style={{ zIndex: -1 }}
                  transition={{ type: "spring", stiffness: 380, damping: 32 }}
                />
              )}
              {opt.label}
            </button>
          );
        })}
      </div>
    </LayoutGroup>
  );
}
