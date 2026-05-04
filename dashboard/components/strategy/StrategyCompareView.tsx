"use client";

import { useRouter, useSearchParams } from "next/navigation";
import clsx from "clsx";
import type { DiffLine } from "@/lib/diff";

type Summary = { added: number; removed: number; identical: boolean };

/** Strategy compare view (audit F9). Doubles as a compact picker when no
 *  compare target is active and as the side-by-side diff renderer when one
 *  is. Server component (`/strategy`) hands us the pre-computed diff lines
 *  so the page render stays single-pass; the client side owns only the
 *  dropdown navigation. */
export function StrategyCompareView({
  baseBotId,
  comparisonBots,
  activeCompareId,
  lines,
  summary,
}: {
  baseBotId: string;
  comparisonBots: Array<{ id: string; name: string }>;
  activeCompareId: string | null;
  lines: DiffLine[] | null;
  summary: Summary | null;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function setCompare(target: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("bot", baseBotId);
    if (target) params.set("compare", target);
    else params.delete("compare");
    router.push(`/strategy?${params.toString()}`);
  }

  // Picker-only mode (no diff to render yet).
  if (!lines || !summary) {
    return (
      <label className="flex items-center gap-2 text-xs">
        <span className="text-[var(--color-muted)] uppercase tracking-[0.14em] text-[10px] font-semibold">
          Compare with
        </span>
        <select
          value={activeCompareId ?? ""}
          onChange={(e) => setCompare(e.target.value || null)}
          className="rounded-lg bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.08)] px-3 py-1.5 text-xs focus:outline-none focus:border-[var(--color-accent)]"
        >
          <option value="">— choose a bot —</option>
          {comparisonBots.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name} ({b.id})
            </option>
          ))}
        </select>
      </label>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-xs">
          <span className="text-[var(--color-muted)] uppercase tracking-[0.14em] text-[10px] font-semibold">
            Compare with
          </span>
          <select
            value={activeCompareId ?? ""}
            onChange={(e) => setCompare(e.target.value || null)}
            className="rounded-lg bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.08)] px-3 py-1.5 text-xs focus:outline-none focus:border-[var(--color-accent)]"
          >
            {comparisonBots.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name} ({b.id})
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          onClick={() => setCompare(null)}
          className="text-[11px] text-[var(--color-muted)] hover:text-[var(--color-text)] underline-offset-2 hover:underline"
        >
          Stop comparing
        </button>
      </div>

      <pre className="text-[12px] font-mono leading-relaxed bg-[rgba(0,0,0,0.3)] rounded-2xl p-4 overflow-auto max-h-[70vh]">
        {lines.map((l, i) => (
          <DiffRow key={i} line={l} />
        ))}
      </pre>
    </div>
  );
}

function DiffRow({ line }: { line: DiffLine }) {
  const cls =
    line.kind === "+"
      ? "text-[var(--color-up)] bg-[var(--color-up)]/10"
      : line.kind === "-"
      ? "text-[var(--color-down)] bg-[var(--color-down)]/10"
      : "text-[var(--color-muted)]";
  return (
    <div className={clsx("whitespace-pre-wrap break-all px-1", cls)}>
      <span className="select-none mr-1">{line.kind}</span>
      {line.text || " "}
    </div>
  );
}
