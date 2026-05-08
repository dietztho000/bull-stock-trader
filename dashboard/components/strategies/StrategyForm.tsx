"use client";

import { useState, useMemo } from "react";
import { mutate } from "swr";
import { Modal } from "@/components/bots/BotsManagerForms";
import type { StrategyDefinition, StrategyParam, StrategyParamKind } from "@/lib/settings";

const STRATEGIES_URL = "/api/strategies";

const inputClass =
  "w-full rounded-lg bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.08)] px-3 py-1.5 text-sm focus:outline-none focus:border-[var(--color-accent)]";

const slugRe = /^[a-z0-9][a-z0-9-]*$/;
const keyRe = /^[A-Z][A-Z0-9_]*$/;

function emptyParam(kind: StrategyParamKind): StrategyParam {
  if (kind === "number") {
    return { kind: "number", key: "NEW_PARAM", label: "New param", value: 0 };
  }
  if (kind === "percent") {
    return { kind: "percent", key: "NEW_PARAM", label: "New param", value: 0, min: -100, max: 100 };
  }
  if (kind === "enum") {
    return { kind: "enum", key: "NEW_PARAM", label: "New param", value: "a", options: ["a", "b"] };
  }
  return { kind: "table", key: "NEW_PARAM", label: "New param", rows: [{ k: "", v: "" }] };
}

export function StrategyForm({
  existing,
  onClose,
}: {
  /** Strategies to offer as "Clone from" options. */
  existing: StrategyDefinition[];
  onClose: () => void;
}) {
  const defaultClone = existing.find((s) => s.slug === "default") ?? existing[0] ?? null;
  const [cloneFromSlug, setCloneFromSlug] = useState<string>(defaultClone?.slug ?? "");
  const cloneSource = useMemo(
    () => existing.find((s) => s.slug === cloneFromSlug) ?? null,
    [existing, cloneFromSlug]
  );

  const [slug, setSlug] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [enabled, setEnabled] = useState(true);
  const [ruleBookTemplate, setRuleBookTemplate] = useState(
    cloneSource?.ruleBookTemplate ?? ""
  );
  const [params, setParams] = useState<StrategyParam[]>(
    () => cloneSource?.params.map((p) => structuredClone(p)) ?? []
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function applyClone(slug: string) {
    setCloneFromSlug(slug);
    if (slug === "") {
      setRuleBookTemplate("");
      setParams([]);
      return;
    }
    const src = existing.find((s) => s.slug === slug);
    if (!src) return;
    setRuleBookTemplate(src.ruleBookTemplate);
    setParams(src.params.map((p) => structuredClone(p)));
  }

  function updateParam(idx: number, next: StrategyParam) {
    setParams((cur) => cur.map((p, i) => (i === idx ? next : p)));
  }

  function removeParam(idx: number) {
    setParams((cur) => cur.filter((_, i) => i !== idx));
  }

  function addParam(kind: StrategyParamKind) {
    setParams((cur) => [...cur, emptyParam(kind)]);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!slugRe.test(slug)) {
      setError("Slug must be lowercase letters, digits, and hyphens.");
      return;
    }
    if (!name.trim()) {
      setError("Name is required.");
      return;
    }
    for (const p of params) {
      if (!keyRe.test(p.key)) {
        setError(`Param key "${p.key}" must be SCREAMING_SNAKE_CASE.`);
        return;
      }
    }
    setBusy(true);
    try {
      const res = await fetch(STRATEGIES_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug,
          name: name.trim(),
          description: description.trim(),
          enabled,
          ruleBookTemplate,
          params,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      await mutate(STRATEGIES_URL);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="New strategy" onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Slug" hint="lowercase, hyphens only — used in memory paths">
            <input
              type="text"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="momentum-v1"
              required
              maxLength={40}
              className={inputClass}
            />
          </Field>
          <Field label="Name">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Momentum v1"
              required
              maxLength={60}
              className={inputClass}
            />
          </Field>
        </div>

        <Field label="Description" hint="Optional. Shown in the strategy card.">
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            maxLength={500}
            className={inputClass}
          />
        </Field>

        <div className="flex items-center gap-3">
          <Field label="Enabled">
            <label className="inline-flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
              />
              <span className="text-[var(--color-muted)]">
                Bots can be assigned this strategy
              </span>
            </label>
          </Field>
          {existing.length > 0 && (
            <Field label="Clone from">
              <select
                value={cloneFromSlug}
                onChange={(e) => applyClone(e.target.value)}
                className={inputClass}
              >
                <option value="">— blank —</option>
                {existing.map((s) => (
                  <option key={s.slug} value={s.slug}>
                    {s.name} ({s.slug})
                  </option>
                ))}
              </select>
            </Field>
          )}
        </div>

        <fieldset className="space-y-2 border-t border-[rgba(255,255,255,0.06)] pt-3">
          <legend className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--color-muted)]">
            Params ({params.length})
          </legend>
          <div className="space-y-2">
            {params.map((p, idx) => (
              <ParamEditor
                key={`${p.key}-${idx}`}
                param={p}
                onChange={(next) => updateParam(idx, next)}
                onRemove={() => removeParam(idx)}
              />
            ))}
          </div>
          <div className="flex flex-wrap gap-2 text-[11px]">
            <span className="text-[var(--color-muted)]">+ Add:</span>
            {(["number", "percent", "enum", "table"] as const).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => addParam(k)}
                className="glass rounded-full px-2 py-0.5 hover:opacity-90"
              >
                {k}
              </button>
            ))}
          </div>
        </fieldset>

        <Field label="Rule book (markdown)" hint="Seeded into memory/<bot>/<slug>/TRADING-STRATEGY.md when first assigned.">
          <textarea
            value={ruleBookTemplate}
            onChange={(e) => setRuleBookTemplate(e.target.value)}
            rows={10}
            className={`${inputClass} font-mono text-[11px]`}
          />
        </Field>

        {error && (
          <div className="text-[11px] text-[var(--color-down)] break-all">{error}</div>
        )}

        <div className="flex items-center justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="glass rounded-full px-3 py-1.5 text-xs disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy}
            className="glass rounded-full px-3 py-1.5 text-xs font-semibold glass-tint-accent disabled:opacity-50"
          >
            {busy ? "Saving…" : "Create strategy"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block text-xs">
      <div className="font-semibold mb-1">{label}</div>
      {children}
      {hint && (
        <div className="text-[10px] text-[var(--color-muted)] mt-1">{hint}</div>
      )}
    </label>
  );
}

function ParamEditor({
  param,
  onChange,
  onRemove,
}: {
  param: StrategyParam;
  onChange: (next: StrategyParam) => void;
  onRemove: () => void;
}) {
  return (
    <div className="rounded-lg border border-[rgba(255,255,255,0.06)] p-2 space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-[10px] uppercase tracking-wider text-[var(--color-muted)] shrink-0 w-14">
          {param.kind}
        </span>
        <input
          type="text"
          value={param.key}
          onChange={(e) => onChange({ ...param, key: e.target.value.toUpperCase() })}
          placeholder="SCREAMING_SNAKE_CASE"
          className={`${inputClass} flex-1 font-mono text-[11px]`}
        />
        <input
          type="text"
          value={param.label}
          onChange={(e) => onChange({ ...param, label: e.target.value })}
          placeholder="Human label"
          className={`${inputClass} flex-1`}
        />
        <button
          type="button"
          onClick={onRemove}
          className="text-[var(--color-muted)] hover:text-[var(--color-down)] text-base px-1"
          aria-label="Remove param"
        >
          ×
        </button>
      </div>
      <ParamKindFields param={param} onChange={onChange} />
    </div>
  );
}

function ParamKindFields({
  param,
  onChange,
}: {
  param: StrategyParam;
  onChange: (next: StrategyParam) => void;
}) {
  if (param.kind === "number") {
    return (
      <div className="grid grid-cols-4 gap-2">
        <NumField label="value" value={param.value} onChange={(v) => onChange({ ...param, value: v ?? 0 })} />
        <NumField label="min" value={param.min} onChange={(v) => onChange({ ...param, min: v })} optional />
        <NumField label="max" value={param.max} onChange={(v) => onChange({ ...param, max: v })} optional />
        <NumField label="step" value={param.step} onChange={(v) => onChange({ ...param, step: v })} optional />
      </div>
    );
  }
  if (param.kind === "percent") {
    return (
      <div className="grid grid-cols-3 gap-2">
        <NumField label="value" value={param.value} onChange={(v) => onChange({ ...param, value: v ?? 0 })} />
        <NumField label="min" value={param.min} onChange={(v) => onChange({ ...param, min: v ?? 0 })} />
        <NumField label="max" value={param.max} onChange={(v) => onChange({ ...param, max: v ?? 0 })} />
      </div>
    );
  }
  if (param.kind === "enum") {
    const optionsText = param.options.join(", ");
    return (
      <div className="space-y-2">
        <label className="block text-[10px] text-[var(--color-muted)]">
          options (comma-separated)
          <input
            type="text"
            value={optionsText}
            onChange={(e) => {
              const opts = e.target.value
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean);
              const value = opts.includes(param.value) ? param.value : (opts[0] ?? "");
              onChange({ ...param, options: opts.length ? opts : [""], value });
            }}
            className={inputClass}
          />
        </label>
        <label className="block text-[10px] text-[var(--color-muted)]">
          value
          <select
            value={param.value}
            onChange={(e) => onChange({ ...param, value: e.target.value })}
            className={inputClass}
          >
            {param.options.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        </label>
      </div>
    );
  }
  // table
  return (
    <div className="space-y-1">
      <div className="grid grid-cols-[1fr_1fr_auto] gap-2 text-[10px] text-[var(--color-muted)]">
        <span>k</span>
        <span>v</span>
        <span />
      </div>
      {param.rows.map((row, i) => (
        <div key={i} className="grid grid-cols-[1fr_1fr_auto] gap-2 items-center">
          <input
            type="text"
            value={String(row.k)}
            onChange={(e) =>
              onChange({
                ...param,
                rows: param.rows.map((r, j) => (j === i ? { ...r, k: coerce(e.target.value) } : r)),
              })
            }
            className={`${inputClass} text-[11px]`}
          />
          <input
            type="text"
            value={String(row.v)}
            onChange={(e) =>
              onChange({
                ...param,
                rows: param.rows.map((r, j) => (j === i ? { ...r, v: coerce(e.target.value) } : r)),
              })
            }
            className={`${inputClass} text-[11px]`}
          />
          <button
            type="button"
            onClick={() =>
              onChange({ ...param, rows: param.rows.filter((_, j) => j !== i) })
            }
            disabled={param.rows.length <= 1}
            className="text-[var(--color-muted)] hover:text-[var(--color-down)] disabled:opacity-40"
            aria-label="Remove row"
          >
            ×
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange({ ...param, rows: [...param.rows, { k: "", v: "" }] })}
        className="text-[10px] text-[var(--color-muted)] hover:text-[var(--color-text)]"
      >
        + add row
      </button>
    </div>
  );
}

function NumField({
  label,
  value,
  onChange,
  optional = false,
}: {
  label: string;
  value: number | undefined;
  onChange: (v: number | undefined) => void;
  optional?: boolean;
}) {
  return (
    <label className="block text-[10px] text-[var(--color-muted)]">
      {label}
      {optional && <span className="text-[9px]"> (opt)</span>}
      <input
        type="number"
        value={value ?? ""}
        onChange={(e) => {
          const v = e.target.value;
          if (v === "") return onChange(undefined);
          const n = Number(v);
          if (Number.isFinite(n)) onChange(n);
        }}
        className={`${inputClass} text-[11px]`}
        step="any"
      />
    </label>
  );
}

/** Best-effort string→number coercion for table rows. Falls back to string. */
function coerce(v: string): string | number {
  if (v === "") return v;
  const n = Number(v);
  return Number.isFinite(n) && v.trim() !== "" ? n : v;
}
