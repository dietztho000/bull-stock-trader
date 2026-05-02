"use client";

import clsx from "clsx";
import type { ReactNode } from "react";

export function FieldRow({
  label,
  description,
  badge,
  children,
}: {
  label: ReactNode;
  description?: ReactNode;
  badge?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="border-b border-[rgba(255,255,255,0.06)] last:border-b-0 pb-4 last:pb-0">
      <div className="flex flex-wrap items-baseline justify-between gap-2 mb-1">
        <label className="text-sm font-medium text-[var(--color-text)]">{label}</label>
        {badge}
      </div>
      {description && (
        <p className="text-xs text-[var(--color-muted)] mb-2 leading-relaxed">{description}</p>
      )}
      <div>{children}</div>
    </div>
  );
}

export function ErrorMsg({ children }: { children: ReactNode }) {
  if (!children) return null;
  return <div className="text-[11px] text-[var(--color-down)] mt-1">{children}</div>;
}

const baseInput =
  "px-3 py-1.5 rounded-lg glass text-[var(--color-text)] focus:outline-none focus:border-[var(--color-accent)] placeholder:text-[var(--color-muted)] text-xs";

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      type="text"
      {...props}
      className={clsx(baseInput, "w-full font-mono", props.className)}
    />
  );
}

export function NumberInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      type="number"
      {...props}
      className={clsx(baseInput, "w-32 tabular", props.className)}
    />
  );
}

export function Select<T extends string>({
  value,
  onChange,
  options,
  className,
}: {
  value: T;
  onChange: (v: T) => void;
  options: ReadonlyArray<{ value: T; label: string }>;
  className?: string;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as T)}
      className={clsx(baseInput, "min-w-[10rem] cursor-pointer", className)}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value} className="bg-[var(--color-panel)]">
          {o.label}
        </option>
      ))}
    </select>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label?: ReactNode;
  disabled?: boolean;
}) {
  return (
    <label
      className={clsx(
        "inline-flex items-center gap-2 cursor-pointer select-none",
        disabled && "opacity-50 cursor-not-allowed"
      )}
    >
      <span
        role="switch"
        aria-checked={checked}
        tabIndex={0}
        onKeyDown={(e) => {
          if (disabled) return;
          if (e.key === " " || e.key === "Enter") {
            e.preventDefault();
            onChange(!checked);
          }
        }}
        onClick={() => !disabled && onChange(!checked)}
        className={clsx(
          "relative inline-block w-9 h-5 rounded-full transition-colors",
          checked
            ? "bg-[color-mix(in_oklch,var(--color-accent)_70%,transparent)]"
            : "bg-[rgba(255,255,255,0.1)]"
        )}
      >
        <span
          className={clsx(
            "absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-md transition-transform",
            checked ? "translate-x-[18px]" : "translate-x-0.5"
          )}
        />
      </span>
      {label && <span className="text-xs">{label}</span>}
    </label>
  );
}

export function SectionFooter({
  dirty,
  pending,
  error,
  onSave,
  onReset,
  resetLabel = "Reset section",
}: {
  dirty: boolean;
  pending: boolean;
  error?: string | null;
  onSave: () => void;
  onReset: () => void;
  resetLabel?: string;
}) {
  return (
    <div className="mt-4 flex items-center gap-2 flex-wrap">
      <button
        type="button"
        onClick={onSave}
        disabled={!dirty || pending}
        className="glass glass-interactive glass-tint-accent rounded-full px-4 py-1.5 text-xs font-semibold disabled:opacity-50"
      >
        {pending ? "Saving…" : "Save changes"}
      </button>
      <button
        type="button"
        onClick={onReset}
        disabled={pending}
        className="glass glass-interactive rounded-full px-3 py-1.5 text-xs font-medium disabled:opacity-50"
      >
        {resetLabel}
      </button>
      {error && <span className="text-[11px] text-[var(--color-down)] break-all">{error}</span>}
    </div>
  );
}
