"use client";

// NEW 2026-05-06 (further enhancement P3): bulk-star symbols by sector.
// Renders a small dropdown of sectors derived from the visible earnings
// list; clicking "Add" stars every symbol in that sector that has an
// upcoming earnings print. No new memory files — derives the candidate
// set from the existing sectorMap + earnings list.

import { useMemo, useState } from "react";
import clsx from "clsx";
import type { EarningsEntry } from "@/lib/parsers/earningsCalendar.shared";

type Props = {
  earnings: EarningsEntry[];
  sectorMap: Map<string, string>;
  watchlist: Set<string>;
  onAddSymbol: (symbol: string) => Promise<void> | void;
};

export function SectorGroupAdd({
  earnings,
  sectorMap,
  watchlist,
  onAddSymbol,
}: Props) {
  const [sector, setSector] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const sectorOptions = useMemo(() => {
    const symbols = new Set(earnings.map((e) => e.symbol.toUpperCase()));
    const counts = new Map<string, number>();
    for (const sym of symbols) {
      const s = sectorMap.get(sym);
      if (!s) continue;
      counts.set(s, (counts.get(s) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([s, n]) => ({ label: `${s} (${n})`, value: s }));
  }, [earnings, sectorMap]);

  if (sectorMap.size === 0 || sectorOptions.length === 0) return null;

  const candidates = useMemo(() => {
    if (!sector) return [];
    const seen = new Set<string>();
    const out: string[] = [];
    for (const e of earnings) {
      const sym = e.symbol.toUpperCase();
      if (seen.has(sym)) continue;
      if (sectorMap.get(sym) !== sector) continue;
      if (watchlist.has(sym)) continue;
      seen.add(sym);
      out.push(sym);
    }
    return out;
  }, [earnings, sectorMap, watchlist, sector]);

  async function addAll() {
    if (busy || !sector || candidates.length === 0) return;
    setBusy(true);
    setStatusMsg(null);
    try {
      for (const sym of candidates) {
        await onAddSymbol(sym);
      }
      setStatusMsg(`+${candidates.length} starred`);
      setTimeout(() => setStatusMsg(null), 3000);
    } catch (err) {
      setStatusMsg("error — see console");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-2 text-xs">
      <label
        htmlFor="sector-group-add"
        className="text-[10px] uppercase tracking-wider text-[var(--color-muted)]"
      >
        Add by sector
      </label>
      <select
        id="sector-group-add"
        value={sector}
        onChange={(e) => setSector(e.target.value)}
        className="px-2 py-1 rounded border border-[var(--color-border)] bg-[var(--color-panel)] text-[var(--color-text)] text-xs focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
      >
        <option value="">— pick —</option>
        {sectorOptions.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={addAll}
        disabled={busy || !sector || candidates.length === 0}
        className={clsx(
          "px-2.5 py-1 rounded border text-xs transition-colors",
          busy || !sector || candidates.length === 0
            ? "border-[var(--color-border)] bg-[var(--color-panel)] text-[var(--color-muted)] opacity-60 cursor-not-allowed"
            : "border-[var(--color-accent)] bg-[var(--color-panel-2)] text-[var(--color-text)] hover:bg-[color-mix(in_oklch,var(--color-accent)_15%,var(--color-panel-2))]"
        )}
        aria-label={
          sector ? `Add ${candidates.length} ${sector} symbols to watchlist` : "Add by sector"
        }
      >
        {busy ? "…" : sector ? `Add ${candidates.length}` : "Add"}
      </button>
      {statusMsg && (
        <span className="text-[10px] text-[var(--color-muted)]">
          {statusMsg}
        </span>
      )}
    </div>
  );
}
