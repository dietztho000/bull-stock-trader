"use client";

import useSWR from "swr";
import clsx from "clsx";

const fetcher = (u: string) => fetch(u).then((r) => r.json());

type Account = { account_number?: string };
type Resp = Account | { error: string };

type DerivedMode = "live" | "paper" | "unknown";

function deriveMode(data: Resp | undefined): {
  mode: DerivedMode;
  accountNumber: string | null;
  error: string | null;
} {
  if (!data) return { mode: "unknown", accountNumber: null, error: null };
  if ("error" in data) {
    return { mode: "unknown", accountNumber: null, error: data.error };
  }
  const acct = data.account_number ?? null;
  if (!acct) return { mode: "unknown", accountNumber: null, error: null };
  return {
    mode: acct.startsWith("PA") ? "paper" : "live",
    accountNumber: acct,
    error: null,
  };
}

const CONFIG: Record<
  DerivedMode,
  { tint: string; dotColor: string; label: string; detail: string }
> = {
  live: {
    tint: "glass-tint-down",
    dotColor: "bg-[var(--color-down)]",
    label: "Live",
    detail: "real money",
  },
  paper: {
    tint: "glass-tint-warn",
    dotColor: "bg-[var(--color-warn)]",
    label: "Paper",
    detail: "simulated",
  },
  unknown: {
    tint: "",
    dotColor: "bg-[var(--color-muted)]",
    label: "Unknown",
    detail: "—",
  },
};

export function ModeBadge() {
  // Shares SWR cache with LiveAccountKpis (same key) — single request total
  // even though multiple components subscribe. dedupingInterval avoids
  // re-fetching across navigations.
  const { data } = useSWR<Resp>("/api/alpaca/account", fetcher, {
    refreshInterval: 60000,
    dedupingInterval: 60000,
    revalidateOnFocus: false,
    revalidateIfStale: false,
  });
  const { mode, accountNumber, error } = deriveMode(data);
  const config = CONFIG[mode];
  const detail = mode === "unknown" && error ? "probe failed" : config.detail;

  return (
    <div
      className={clsx(
        "glass rounded-full px-3 py-1.5 inline-flex items-center gap-2",
        config.tint
      )}
      title={[
        accountNumber && `acct: ${accountNumber}`,
        error && `error: ${error.slice(0, 120)}`,
      ]
        .filter(Boolean)
        .join("\n")}
    >
      <span className={clsx("w-2 h-2 rounded-full pulse-dot", config.dotColor)} />
      <span className="text-xs font-semibold tracking-wide">{config.label}</span>
      <span className="text-[10px] uppercase tracking-[0.12em] text-[var(--color-muted)]">
        {detail}
      </span>
    </div>
  );
}
