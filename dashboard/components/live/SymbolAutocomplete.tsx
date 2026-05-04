"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import useSWR from "swr";
import clsx from "clsx";
import { useTradingAccountOptional } from "@/lib/tradingAccountContext";

const fetcher = (u: string) => fetch(u).then((r) => r.json());

type Suggestion = { symbol: string; source: string; detail?: string };

const SOURCE_TONE: Record<string, string> = {
  held: "text-[var(--color-up)]",
  research: "text-[var(--color-accent)]",
  recent: "text-[var(--color-muted)]",
};

const SOURCE_LABEL: Record<string, string> = {
  held: "held",
  research: "today's research",
  recent: "recent trade",
};

/** Audit F8 — symbol autocomplete for OrderEntryTile. Wraps a bare input
 *  with a dropdown of candidates pulled from `/api/symbols/suggest`:
 *  held positions first, then today's RESEARCH-LOG ideas, then recent
 *  closed trades. Filters by prefix as the user types. Reduces typo risk
 *  on live submissions and surfaces the bot's own shortlist. */
export function SymbolAutocomplete({
  value,
  onChange,
  placeholder,
  className,
}: {
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  className?: string;
}) {
  const ctx = useTradingAccountOptional();
  const botId = ctx?.botId ?? null;

  const { data } = useSWR<{ suggestions: Suggestion[] }>(
    botId ? `/api/symbols/suggest?bot=${encodeURIComponent(botId)}` : null,
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 60_000,
      keepPreviousData: true,
    }
  );

  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Outside click closes the dropdown.
  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!wrapRef.current) return;
      if (!wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const filtered = useMemo(() => {
    const all = data?.suggestions ?? [];
    if (!value) return all.slice(0, 12);
    const prefix = value.toUpperCase();
    return all.filter((s) => s.symbol.startsWith(prefix)).slice(0, 12);
  }, [data, value]);

  function pick(symbol: string) {
    onChange(symbol);
    setOpen(false);
    inputRef.current?.blur();
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || filtered.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => (h + 1) % filtered.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => (h - 1 + filtered.length) % filtered.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const pickEl = filtered[highlight] ?? filtered[0];
      if (pickEl) pick(pickEl.symbol);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div ref={wrapRef} className="relative">
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => {
          onChange(e.target.value.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 5));
          setOpen(true);
          setHighlight(0);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        className={className}
        autoComplete="off"
        spellCheck={false}
      />
      {open && filtered.length > 0 && (
        <div className="absolute z-30 left-0 right-0 mt-1 frost rounded-lg border border-[rgba(255,255,255,0.08)] py-1 shadow-lg max-h-64 overflow-y-auto">
          {filtered.map((s, i) => (
            <button
              key={s.symbol}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                pick(s.symbol);
              }}
              onMouseEnter={() => setHighlight(i)}
              className={clsx(
                "w-full text-left px-2.5 py-1.5 text-xs flex items-baseline gap-2",
                i === highlight && "bg-[rgba(255,255,255,0.05)]"
              )}
            >
              <span className="font-mono font-semibold w-12">{s.symbol}</span>
              <span
                className={clsx(
                  "text-[10px] uppercase tracking-[0.12em] w-24 shrink-0",
                  SOURCE_TONE[s.source] ?? "text-[var(--color-muted)]"
                )}
              >
                {SOURCE_LABEL[s.source] ?? s.source}
              </span>
              {s.detail && (
                <span className="text-[10px] text-[var(--color-muted)] truncate flex-1">
                  {s.detail}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
