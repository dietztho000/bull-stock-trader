import clsx from "clsx";
import type { ReactNode } from "react";

export function Card({
  title,
  subtitle,
  children,
  className,
  right,
}: {
  title?: string;
  subtitle?: string;
  children: ReactNode;
  className?: string;
  right?: ReactNode;
}) {
  return (
    <section
      className={clsx(
        "rounded-lg border border-[var(--color-border)] bg-[var(--color-panel)] p-4",
        className
      )}
    >
      {(title || right) && (
        <header className="flex items-baseline justify-between mb-3">
          <div>
            {title && (
              <h2 className="text-sm font-semibold tracking-wide uppercase text-[var(--color-muted)]">
                {title}
              </h2>
            )}
            {subtitle && (
              <div className="text-xs text-[var(--color-muted)] mt-0.5">
                {subtitle}
              </div>
            )}
          </div>
          {right}
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
  return (
    <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-panel)] p-3">
      <div className="text-[11px] uppercase tracking-wider text-[var(--color-muted)]">
        {label}
      </div>
      <div className="mt-1 text-2xl font-semibold tabular">{value}</div>
      <div className="mt-0.5 text-xs flex items-center gap-2">
        {delta && (
          <span
            className={clsx(
              "tabular",
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
    neutral: "bg-[var(--color-panel-2)] text-[var(--color-text)] border-[var(--color-border)]",
    up: "bg-green-500/10 text-[var(--color-up)] border-green-500/30",
    down: "bg-red-500/10 text-[var(--color-down)] border-red-500/30",
    warn: "bg-amber-500/10 text-[var(--color-warn)] border-amber-500/30",
  }[tone];
  return (
    <span
      className={clsx(
        "inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium border tabular",
        cls
      )}
    >
      {children}
    </span>
  );
}
