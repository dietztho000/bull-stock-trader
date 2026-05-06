"use client";

import clsx from "clsx";
import { useEffect, useRef, useState } from "react";
import type { AlpacaMode } from "@/lib/alpacaMode";
import { useTradingAccount } from "@/lib/tradingAccountContext";
import { useMarketClock } from "@/lib/useMarketClock";
import { useSettingsOptional } from "@/components/providers/SettingsProvider";
import type { Bot, RedactedAccount } from "@/lib/settings";

const TINT_FOR: Record<AlpacaMode, string> = {
  live: "glass-tint-down",
  paper: "glass-tint-warn",
};

const DOT_FOR: Record<AlpacaMode, string> = {
  live: "bg-[var(--color-down)]",
  paper: "bg-[var(--color-warn)]",
};

export function AccountSelector() {
  const { botId, account, bot, accountRecord, isPending, requestSetAccount } =
    useTradingAccount();
  const settingsCtx = useSettingsOptional();
  const bots: Bot[] = settingsCtx?.bots ?? [];
  const accounts: RedactedAccount[] = settingsCtx?.accounts ?? [];
  const enabledBots = bots.filter((b) => b.enabled);

  const [open, setOpen] = useState(false);
  const [pendingConfirm, setPendingConfirm] = useState<{
    next: string;
    commit: () => void;
  } | null>(null);

  const wrapRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function handleSelect(next: string) {
    setOpen(false);
    if (next === botId) return;
    const { requiresConfirm, commit } = requestSetAccount(next);
    if (requiresConfirm) {
      setPendingConfirm({ next, commit });
    } else {
      commit();
    }
  }

  const activeLabel = bot?.name ?? botId;

  return (
    <>
      <div ref={wrapRef} className="relative">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-haspopup="listbox"
          aria-expanded={open}
          title={accountRecord ? `Account: ${accountRecord.label}` : undefined}
          className={clsx(
            "glass inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold transition-opacity",
            TINT_FOR[account],
            isPending && "opacity-70"
          )}
        >
          <span className={clsx("h-1.5 w-1.5 rounded-full", DOT_FOR[account])} />
          <span className="max-w-[140px] truncate">{activeLabel}</span>
          <span className="text-[10px] uppercase tracking-[0.14em] text-[var(--color-muted)]">
            {account}
          </span>
          <span className="text-[10px] text-[var(--color-muted)]">▾</span>
        </button>

        {open && (
          <div
            role="listbox"
            aria-label="Trading bot"
            className="frost absolute right-0 mt-2 w-80 rounded-xl py-1.5 shadow-lg z-40 max-h-[60vh] overflow-y-auto"
          >
            {enabledBots.length === 0 ? (
              <div className="px-3 py-2 text-xs text-[var(--color-muted)]">
                No enabled bots. Visit{" "}
                <a className="text-[var(--color-accent)] underline" href="/bots">
                  /bots
                </a>{" "}
                to add one.
              </div>
            ) : (
              groupBotsByAccount(enabledBots, accounts).map((group, gi) => (
                <div
                  key={group.accountId}
                  className={gi > 0 ? "border-t border-[rgba(255,255,255,0.05)] mt-1 pt-1" : ""}
                >
                  <div className="flex items-center gap-2 px-3 pt-1.5 pb-1">
                    <span
                      className={clsx(
                        "h-1.5 w-1.5 rounded-full shrink-0",
                        DOT_FOR[group.mode]
                      )}
                    />
                    <span className="text-[10px] uppercase tracking-[0.14em] text-[var(--color-muted)] font-semibold truncate">
                      {group.label}
                    </span>
                    <span className="text-[10px] text-[var(--color-muted)]">
                      {group.bots.length} bot{group.bots.length === 1 ? "" : "s"}
                    </span>
                  </div>
                  {group.bots.map((b) => {
                    const isActive = b.id === botId;
                    return (
                      <button
                        key={b.id}
                        type="button"
                        role="option"
                        aria-selected={isActive}
                        onClick={() => handleSelect(b.id)}
                        className={clsx(
                          "w-full text-left pl-7 pr-3 py-1.5 hover:bg-[rgba(255,255,255,0.04)] flex items-start gap-2",
                          isActive && "bg-[rgba(255,255,255,0.04)]"
                        )}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold truncate">{b.name}</span>
                            {isActive && (
                              <span className="text-[10px] text-[var(--color-accent)]">
                                ●
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-[var(--color-muted)] truncate">
                            id: {b.id}
                            {b.allocation != null && (
                              <>
                                {" · "}
                                {b.allocation.toLocaleString("en-US", {
                                  style: "currency",
                                  currency: "USD",
                                  maximumFractionDigits: 0,
                                })}{" "}
                                slice
                              </>
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              ))
            )}
            <div className="border-t border-[rgba(255,255,255,0.05)] mt-1 pt-1">
              <a
                href="/bots"
                className="block px-3 py-2 text-xs text-[var(--color-accent)] hover:bg-[rgba(255,255,255,0.04)]"
              >
                + New bot · Manage…
              </a>
            </div>
          </div>
        )}
      </div>
      {pendingConfirm && (
        <LiveConfirmDialog
          currentMode={account}
          targetBotName={
            bots.find((b) => b.id === pendingConfirm.next)?.name ?? pendingConfirm.next
          }
          onCancel={() => setPendingConfirm(null)}
          onConfirm={() => {
            pendingConfirm.commit();
            setPendingConfirm(null);
          }}
        />
      )}
    </>
  );
}

type BotGroup = {
  accountId: string;
  label: string;
  mode: AlpacaMode;
  bots: Bot[];
};

/** Group enabled bots by their bound account, sorted with active mode first.
 *  Lets the dropdown render account-headed sections instead of one flat list,
 *  which gets unreadable past 5–6 bots (audit U1). */
function groupBotsByAccount(bots: Bot[], accounts: RedactedAccount[]): BotGroup[] {
  const accountById = new Map(accounts.map((a) => [a.id, a]));
  const byAccount = new Map<string, Bot[]>();
  for (const b of bots) {
    const list = byAccount.get(b.accountId) ?? [];
    list.push(b);
    byAccount.set(b.accountId, list);
  }
  const groups: BotGroup[] = [];
  for (const [accountId, members] of byAccount) {
    const acct = accountById.get(accountId);
    groups.push({
      accountId,
      label: acct?.label ?? accountId,
      mode: acct?.mode ?? "paper",
      bots: members,
    });
  }
  // Live accounts render last so the eye-catching red is at the bottom (less
  // accidental misclicks when the dropdown opens at the top of the list).
  groups.sort((a, b) => {
    if (a.mode !== b.mode) return a.mode === "paper" ? -1 : 1;
    return a.label.localeCompare(b.label);
  });
  return groups;
}

function LiveConfirmDialog({
  currentMode,
  targetBotName,
  onCancel,
  onConfirm,
}: {
  currentMode: AlpacaMode;
  targetBotName: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const marketOpen = useMarketClock({ mode: currentMode }).isOpen ?? false;
  const confirmRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    confirmRef.current?.focus();
    function onKey(e: globalThis.KeyboardEvent) {
      if (e.key === "Escape") onCancel();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="live-confirm-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
      onClick={onCancel}
    >
      <div
        className="frost rounded-2xl p-6 max-w-sm w-full glass-tint-down"
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          id="live-confirm-title"
          className="text-base font-semibold text-[var(--color-text)]"
        >
          Switch to {targetBotName} (LIVE)?
        </h2>
        <p className="mt-2 text-sm text-[var(--color-muted)]">
          This bot is bound to a live Alpaca account. Stat tiles, positions,
          and orders will reflect real money. You will not be asked again
          this session.
        </p>
        {marketOpen && (
          <div className="mt-3 rounded-lg border border-[var(--color-warn)]/40 bg-[var(--color-warn)]/10 p-2.5 text-[11px] text-[var(--color-warn)]">
            ⚠️ Market is currently OPEN. Switching mid-session means any order
            you place from the dashboard will hit the live tape immediately.
          </div>
        )}
        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="glass rounded-full px-4 py-1.5 text-xs font-semibold text-[var(--color-text)] hover:opacity-90"
          >
            Cancel
          </button>
          <button
            ref={confirmRef}
            type="button"
            onClick={onConfirm}
            className="glass glass-tint-down rounded-full px-4 py-1.5 text-xs font-semibold text-[var(--color-text)] hover:opacity-90"
          >
            Switch to Live
          </button>
        </div>
      </div>
    </div>
  );
}
