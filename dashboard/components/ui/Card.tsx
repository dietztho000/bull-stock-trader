import clsx from "clsx";
import type { ReactNode } from "react";

export function Card({
  title,
  subtitle,
  children,
  className,
  right,
}: {
  title?: ReactNode;
  subtitle?: ReactNode;
  children: ReactNode;
  className?: string;
  right?: ReactNode;
}) {
  return (
    <section
      className={clsx(
        "frost rounded-2xl p-5",
        className
      )}
    >
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

export function Kpi({
  label,
  value,
  delta,
  hint,
}: {
  label: string;
  value: string;
  delta?: { value: string; positive?: boolean | null };
  hint?: string;
}) {
  const accent =
    delta?.positive === true
      ? "before:bg-[var(--color-up)]"
      : delta?.positive === false
      ? "before:bg-[var(--color-down)]"
      : "before:bg-transparent";
  return (
    <div
      className={clsx(
        "frost rounded-xl p-3.5 relative overflow-hidden",
        "before:absolute before:left-0 before:top-2 before:bottom-2 before:w-[2px] before:rounded-full",
        accent
      )}
    >
      <div className="text-[10px] uppercase tracking-[0.14em] text-[var(--color-muted)] font-medium">
        {label}
      </div>
      <div className="mt-1.5 text-2xl font-semibold tabular tracking-tight">
        {value}
      </div>
      <div className="mt-0.5 text-xs flex items-center gap-2">
        {delta && (
          <span
            className={clsx(
              "tabular font-medium",
              delta.positive === true && "text-[var(--color-up)]",
              delta.positive === false && "text-[var(--color-down)]",
              delta.positive == null && "text-[var(--color-muted)]"
            )}
          >
            {delta.value}
          </span>
        )}
        {hint && <span className="text-[var(--color-muted)]">{hint}</span>}
      </div>
    </div>
  );
}

export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "up" | "down" | "warn";
}) {
  const cls = {
    neutral:
      "bg-[rgba(255,255,255,0.05)] text-[var(--color-text)] border-[rgba(255,255,255,0.08)]",
    up: "bg-[color-mix(in_oklch,var(--color-up)_18%,transparent)] text-[var(--color-up)] border-[color-mix(in_oklch,var(--color-up)_40%,transparent)]",
    down: "bg-[color-mix(in_oklch,var(--color-down)_18%,transparent)] text-[var(--color-down)] border-[color-mix(in_oklch,var(--color-down)_40%,transparent)]",
    warn: "bg-[color-mix(in_oklch,var(--color-warn)_18%,transparent)] text-[var(--color-warn)] border-[color-mix(in_oklch,var(--color-warn)_40%,transparent)]",
  }[tone];
  return (
    <span
      className={clsx(
        "inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border tabular",
        cls
      )}
    >
      {children}
    </span>
  );
}
