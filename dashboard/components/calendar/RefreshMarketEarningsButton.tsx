"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";

type Status =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "ok"; added: number; replaced: number; dropped: number; total: number }
  | { kind: "error"; message: string };

export function RefreshMarketEarningsButton() {
  const router = useRouter();
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [, startTransition] = useTransition();

  async function refresh() {
    setStatus({ kind: "loading" });
    try {
      const resp = await fetch("/api/calendar/earnings", { method: "POST" });
      const data = await resp.json();
      if (!resp.ok) {
        setStatus({ kind: "error", message: data?.error ?? `HTTP ${resp.status}` });
        return;
      }
      setStatus({
        kind: "ok",
        added: data?.merge?.added ?? 0,
        replaced: data?.merge?.replaced ?? 0,
        dropped: data?.merge?.dropped ?? 0,
        total: data?.merge?.total ?? 0,
      });
      startTransition(() => router.refresh());
    } catch (err) {
      setStatus({
        kind: "error",
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  const loading = status.kind === "loading";
  return (
    <div className="flex items-center gap-2">
      {status.kind === "ok" && (
        <span className="text-[10px] text-[var(--color-up)]">
          {status.total} entries · +{status.added} added · {status.dropped} dropped
        </span>
      )}
      {status.kind === "error" && (
        <span
          className="text-[10px] text-[var(--color-down)] max-w-[300px] truncate"
          title={status.message}
        >
          {status.message}
        </span>
      )}
      <button
        type="button"
        onClick={refresh}
        disabled={loading}
        className={clsx(
          "px-3 py-1.5 text-xs rounded border border-[var(--color-border)] bg-[var(--color-panel)]",
          "hover:bg-[var(--color-panel-2)] hover:text-[var(--color-accent)]",
          loading && "opacity-50 cursor-not-allowed"
        )}
      >
        {loading ? "Refreshing…" : "Refresh market earnings"}
      </button>
    </div>
  );
}
