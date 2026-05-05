"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { useToastOptional } from "@/components/providers/ToastProvider";
import type { SyncStatus } from "@/lib/memoryFreshness";

type ButtonState = "idle" | "syncing" | "ok" | "error";

export function MemorySyncButton({
  initialStatus,
}: {
  initialStatus: SyncStatus;
}) {
  const toast = useToastOptional();
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [state, setState] = useState<ButtonState>("idle");

  const initialErrored = initialStatus === "error";

  async function trigger() {
    if (state === "syncing") return;
    setState("syncing");
    try {
      const resp = await fetch("/api/sync", { method: "POST" });
      const data = await resp.json().catch(() => ({}));
      if (resp.ok && data.ok) {
        setState("ok");
        toast?.push({
          tone: "success",
          title: "Pulled cloud routine writes",
          detail: data.status?.message ?? undefined,
          ttl: 3000,
        });
        // SSE-driven LiveRefresh handles UI updates when memory files
        // change, but the pill itself is a server component — refresh so
        // the new lastSyncMs flows through.
        startTransition(() => router.refresh());
      } else {
        setState("error");
        toast?.push({
          tone: "error",
          title: "Sync failed",
          detail:
            data?.status?.message ??
            data?.error ??
            `HTTP ${resp.status}`,
        });
      }
    } catch (err) {
      setState("error");
      toast?.push({
        tone: "error",
        title: "Sync failed",
        detail: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setTimeout(() => setState("idle"), 2400);
    }
  }

  const showError = state === "error" || (state === "idle" && initialErrored);
  const showOk = state === "ok";
  const showSyncing = state === "syncing";

  return (
    <button
      type="button"
      onClick={trigger}
      disabled={showSyncing}
      aria-label={showSyncing ? "Syncing memory…" : "Pull latest cloud-routine writes"}
      title={showSyncing ? "Syncing…" : "Pull now"}
      className={clsx(
        "ml-1 w-6 h-6 rounded-full inline-flex items-center justify-center transition-colors",
        "text-[var(--color-muted)] hover:text-[var(--color-text)]",
        "hover:bg-white/10 disabled:cursor-wait disabled:opacity-70",
        showError && "text-[var(--color-down)]",
        showOk && "text-[var(--color-up)]"
      )}
    >
      <RefreshIcon spinning={showSyncing} ok={showOk} error={showError} />
    </button>
  );
}

function RefreshIcon({
  spinning,
  ok,
  error,
}: {
  spinning: boolean;
  ok: boolean;
  error: boolean;
}) {
  if (ok) {
    return (
      <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
        <path
          d="M2.5 6.5l2.2 2.2L9.5 3.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  if (error) {
    return (
      <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
        <path
          d="M3 3l6 6M9 3L3 9"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
      </svg>
    );
  }
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 12 12"
      className={spinning ? "animate-spin" : undefined}
      aria-hidden="true"
    >
      <path
        d="M10 6a4 4 0 1 1-1.17-2.83"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      <path
        d="M10.5 1.5V4H8"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
