"use client";

import useSWR from "swr";
import clsx from "clsx";
import { useTradingAccount } from "@/lib/tradingAccountContext";
import { alpacaApiUrl, type AlpacaMode } from "@/lib/alpacaMode";
import {
  type AlpacaAccount,
  type AlpacaErrorEnvelope,
  isAlpacaError,
} from "@/lib/types/alpaca";

const fetcher = (u: string) => fetch(u).then((r) => r.json());

type Resp = AlpacaAccount | AlpacaErrorEnvelope;

const CONFIG: Record<
  AlpacaMode,
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
};

export function ModeBadge() {
  const { account, accountId, accountRecord, bot } = useTradingAccount();
  // Tooltip query — route through the bot's bound accountId when known so
  // multi-paper-account installs surface the right account_number, not
  // whichever happens to be in the legacy ALPACA_PAPER_* env slot.
  const { data, error } = useSWR<Resp>(
    alpacaApiUrl("account", accountId ? { accountId } : { mode: account }),
    fetcher,
    {
      refreshInterval: 60000,
      dedupingInterval: 60000,
      revalidateOnFocus: false,
      revalidateIfStale: false,
      keepPreviousData: true,
    }
  );

  const config = CONFIG[account];
  const accountNumber =
    data && !isAlpacaError(data) ? data.account_number ?? null : null;
  const probeError =
    error?.message ??
    (data && isAlpacaError(data) ? data.error : null);

  return (
    <div
      className={clsx(
        "glass rounded-full px-3 py-1.5 inline-flex items-center gap-2",
        config.tint
      )}
      title={[
        bot && `bot: ${bot.name}`,
        accountRecord && `account: ${accountRecord.label}`,
        accountNumber && `acct #: ${accountNumber}`,
        probeError && `error: ${String(probeError).slice(0, 120)}`,
      ]
        .filter(Boolean)
        .join("\n")}
    >
      <span className={clsx("w-2 h-2 rounded-full pulse-dot", config.dotColor)} />
      <span className="text-xs font-semibold tracking-wide">{config.label}</span>
      <span className="text-[10px] uppercase tracking-[0.12em] text-[var(--color-muted)]">
        {config.detail}
      </span>
    </div>
  );
}
