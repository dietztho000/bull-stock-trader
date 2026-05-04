"use client";

import useSWR from "swr";
import clsx from "clsx";
import { fmtTimeOfDayCT, fmtWeekdayTimeCT } from "@/lib/time";
import { useLiveSwr } from "@/lib/useLiveSwr";
import { useTradingAccountOptional } from "@/lib/tradingAccountContext";
import { alpacaApiUrl } from "@/lib/alpacaMode";

const fetcher = (u: string) => fetch(u).then((r) => r.json());

type Clock = { is_open: boolean; next_open: string; next_close: string };

export function MarketClock() {
  const ctx = useTradingAccountOptional();
  const accountId = ctx?.accountId ?? null;
  const mode = ctx?.account;
  const liveOpts = useLiveSwr(30000);
  const { data } = useSWR<Clock | { error: string }>(
    alpacaApiUrl("clock", accountId ? { accountId } : { mode }),
    fetcher,
    liveOpts
  );

  if (!data || "error" in data) {
    return (
      <div className="glass rounded-full px-3 py-1.5 inline-flex items-center gap-2">
        <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-muted)]" />
        <span className="text-xs text-[var(--color-muted)]">Market: unknown</span>
      </div>
    );
  }

  const c = data as Clock;
  const dotColor = c.is_open ? "bg-[var(--color-up)]" : "bg-[var(--color-warn)]";
  const tint = c.is_open ? "glass-tint-up" : "glass-tint-warn";

  if (c.is_open) {
    return (
      <div className={clsx("glass rounded-full px-3 py-1.5 inline-flex items-center gap-2", tint)}>
        <span className={clsx("w-1.5 h-1.5 rounded-full pulse-dot", dotColor)} />
        <span className="text-xs font-medium">Market open</span>
        <span className="text-[10px] text-[var(--color-muted)] tabular">
          closes {fmtTimeOfDayCT(c.next_close)}
        </span>
      </div>
    );
  }

  return (
    <div className={clsx("glass rounded-full px-3 py-1.5 inline-flex items-center gap-2", tint)}>
      <span className={clsx("w-1.5 h-1.5 rounded-full", dotColor)} />
      <span className="text-xs font-medium">Closed</span>
      <span className="text-[10px] text-[var(--color-muted)] tabular">
        opens {fmtWeekdayTimeCT(c.next_open)}
      </span>
    </div>
  );
}
