"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export function RunFreshButton({ mode = "paper" }: { mode?: "paper" | "live" }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const disabled = pending;

  async function onClick() {
    setError(null);
    try {
      const resp = await fetch(`/api/backtest/run?mode=${mode}`, {
        method: "POST",
      });
      if (!resp.ok) {
        const body = await resp.json().catch(() => ({}));
        setError(body?.error ?? `HTTP ${resp.status}`);
        return;
      }
      // Refresh the server tree to re-render the page with new data.
      startTransition(() => router.refresh());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={onClick}
        disabled={disabled}
        className="px-3 py-1.5 rounded text-xs font-medium border border-[var(--color-border)] bg-[var(--color-panel-2)] hover:bg-[var(--color-accent)]/10 hover:text-[var(--color-accent)] disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {pending ? "Running…" : "Run fresh"}
      </button>
      {error && (
        <div className="text-[11px] text-[var(--color-down)]">{error}</div>
      )}
    </div>
  );
}
