"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { useToastOptional } from "@/components/providers/ToastProvider";
import type { SyncStatus } from "@/lib/memoryFreshness";

type ButtonState = "idle" | "syncing" | "ok" | "error";

type SyncRunStatus = {
  startedAt?: string;
  finishedAt?: string;
  exitCode?: number;
  message?: string;
};

const POLL_MS = 1_000;
const POLL_TIMEOUT_MS = 60_000;

/** Polls `/api/sync/status` until the script reports a `finishedAt` later
 *  than `triggeredAtMs`. Returns null on timeout. The status file is
 *  shared with launchd-cron runs, so we use the timestamp gate to avoid
 *  picking up a stale completion from a cron tick that landed seconds
 *  before the user clicked. */
async function pollSyncStatus(
  triggeredAtMs: number
): Promise<SyncRunStatus | null> {
  const deadline = triggeredAtMs + POLL_TIMEOUT_MS;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, POLL_MS));
    try {
      const resp = await fetch("/api/sync/status");
      if (!resp.ok) continue;
      const body = (await resp.json()) as { status: SyncRunStatus | null };
      const status = body.status;
      if (!status?.finishedAt) continue;
      const finishedMs = Date.parse(status.finishedAt);
      if (Number.isFinite(finishedMs) && finishedMs >= triggeredAtMs - 1000) {
        return status;
      }
    } catch {
      // transient — keep polling until the deadline
    }
  }
  return null;
}

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
    const triggeredAtMs = Date.now();
    try {
      const resp = await fetch("/api/sync", { method: "POST" });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok || !data.ok) {
        setState("error");
        toast?.push({
          tone: "error",
          title: "Sync failed",
          detail: data?.error ?? `HTTP ${resp.status}`,
        });
        return;
      }
      // Audit NA6 — POST returns 202 immediately. Poll the status file
      // until the script's most recent `finishedAt` is newer than when we
      // pressed the button (giving the kicked-off run time to land).
      const finalStatus = await pollSyncStatus(triggeredAtMs);
      if (!finalStatus) {
        setState("error");
        toast?.push({
          tone: "error",
          title: "Sync timed out",
          detail: "cron-sync.sh did not report completion within 60s",
        });
        return;
      }
      if (finalStatus.exitCode === 0) {
        setState("ok");
        toast?.push({
          tone: "success",
          title: "Pulled cloud routine writes",
          detail: finalStatus.message ?? undefined,
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
          detail: finalStatus.message ?? `exit ${finalStatus.exitCode}`,
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
