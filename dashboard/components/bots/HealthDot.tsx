"use client";

import useSWR from "swr";
import clsx from "clsx";
import type { BotHealth } from "@/app/api/bots/[id]/healthcheck/route";

const fetcher = (u: string) => fetch(u).then((r) => r.json());

/** Audit F1 — small connectivity dot for a bot's bound Alpaca account.
 *  Polls `/api/bots/<id>/healthcheck` every 60s and renders one of:
 *    - green dot: probe succeeded (creds valid, account reachable)
 *    - red dot:   probe failed (creds revoked, network, etc.)
 *    - grey dot:  initial loading
 *
 *  Click-to-fix (follow-up #3): when a parent passes `onClickFailed` and
 *  the dot is in the failed state, the dot becomes a button that opens the
 *  caller's recovery flow (typically the Edit-Bot modal pre-focused on
 *  the API key field). Healthy/loading dots stay decorative.
 *
 *  Shares no state with `BotsLeaderboard`'s row.error — BotsLeaderboard
 *  derives health from whether the equity fetch errored, which is a
 *  weaker signal (a stale Alpaca cache could mask a credential failure).
 *  The dedicated probe is the source of truth. */
export function HealthDot({
  botId,
  size = "sm",
  refreshIntervalMs = 60_000,
  onClickFailed,
}: {
  botId: string;
  size?: "sm" | "md";
  refreshIntervalMs?: number;
  /** When set, a failed dot becomes a clickable affordance that invokes
   *  this handler — meant to open the Edit-Bot modal so the user can
   *  paste fresh credentials without hunting for the action. */
  onClickFailed?: () => void;
}) {
  const { data, error, isLoading } = useSWR<BotHealth>(
    `/api/bots/${encodeURIComponent(botId)}/healthcheck`,
    fetcher,
    {
      refreshInterval: refreshIntervalMs,
      revalidateOnFocus: false,
      keepPreviousData: true,
    }
  );

  const dim = size === "md" ? "w-2.5 h-2.5" : "w-2 h-2";

  let tone: "loading" | "ok" | "fail";
  let title: string;
  if (isLoading && !data) {
    tone = "loading";
    title = "Checking Alpaca connectivity…";
  } else if (error || !data) {
    tone = "fail";
    title = `Healthcheck request failed: ${
      error instanceof Error ? error.message : String(error ?? "unknown")
    }`;
  } else if (data.ok) {
    tone = "ok";
    title = `Alpaca OK · ${data.latencyMs}ms${
      data.accountNumber ? ` · #${data.accountNumber}` : ""
    }${data.status ? ` · ${data.status}` : ""}`;
  } else {
    tone = "fail";
    title = `Alpaca FAILED · ${data.latencyMs}ms\n${data.error}`;
  }

  if (tone === "fail" && onClickFailed) {
    return (
      <button
        type="button"
        onClick={onClickFailed}
        title={`${title}\n\nClick to fix credentials.`}
        aria-label={`${title} — click to fix credentials`}
        className={clsx(
          "inline-block rounded-full bg-[var(--color-down)] animate-pulse",
          "hover:ring-2 hover:ring-[var(--color-down)]/40 cursor-pointer",
          dim
        )}
      />
    );
  }

  return (
    <span
      title={title}
      aria-label={title}
      role="status"
      className={clsx(
        "inline-block rounded-full",
        dim,
        tone === "ok" && "bg-[var(--color-up)]",
        tone === "fail" && "bg-[var(--color-down)] animate-pulse",
        tone === "loading" && "bg-[var(--color-muted)] opacity-50"
      )}
    />
  );
}
