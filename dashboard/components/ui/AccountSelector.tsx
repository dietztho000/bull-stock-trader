"use client";

import clsx from "clsx";
import { LayoutGroup, motion } from "framer-motion";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import type { AlpacaMode } from "@/lib/alpacaMode";
import { useTradingAccount } from "@/lib/tradingAccountContext";

const OPTIONS: { value: AlpacaMode; label: string; short: string }[] = [
  { value: "live", label: "Live", short: "L" },
  { value: "paper", label: "Paper", short: "P" },
];

const TINT_FOR: Record<AlpacaMode, string> = {
  live: "glass-tint-down",
  paper: "glass-tint-warn",
};

export function AccountSelector() {
  const { account, isPending, requestSetAccount } = useTradingAccount();
  const [pendingConfirm, setPendingConfirm] = useState<{
    next: AlpacaMode;
    commit: () => void;
  } | null>(null);

  function handleSelect(next: AlpacaMode) {
    if (next === account) return;
    const { requiresConfirm, commit } = requestSetAccount(next);
    if (requiresConfirm) {
      setPendingConfirm({ next, commit });
    } else {
      commit();
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const idx = OPTIONS.findIndex((o) => o.value === account);
    const dir = event.key === "ArrowRight" ? 1 : -1;
    const nextIdx = (idx + dir + OPTIONS.length) % OPTIONS.length;
    handleSelect(OPTIONS[nextIdx].value);
  }

  return (
    <>
      <LayoutGroup id="account-selector">
        <div
          role="radiogroup"
          aria-label="Trading account"
          title="Switch between Live and Paper trading accounts"
          onKeyDown={handleKeyDown}
          className={clsx(
            "glass inline-flex items-center gap-1 rounded-full p-1 transition-opacity",
            isPending && "opacity-70"
          )}
        >
          <span className="sr-only">Trading account</span>
          {OPTIONS.map((opt) => {
            const active = opt.value === account;
            return (
              <button
                key={opt.value}
                type="button"
                role="radio"
                aria-checked={active}
                tabIndex={active ? 0 : -1}
                onClick={() => handleSelect(opt.value)}
                className={clsx(
                  "relative px-3.5 py-1.5 rounded-full text-xs font-semibold tracking-wide transition-colors z-10",
                  active
                    ? "text-[var(--color-text)]"
                    : "text-[var(--color-muted)] hover:text-[var(--color-text)]"
                )}
              >
                {active && (
                  <motion.span
                    layoutId="account-selector-active"
                    className={clsx(
                      "absolute inset-0 rounded-full",
                      TINT_FOR[opt.value]
                    )}
                    style={{ zIndex: -1 }}
                    transition={{ type: "spring", stiffness: 380, damping: 32 }}
                  />
                )}
                <span className="hidden sm:inline">{opt.label}</span>
                <span className="sm:hidden">{opt.short}</span>
              </button>
            );
          })}
        </div>
      </LayoutGroup>
      {pendingConfirm && (
        <LiveConfirmDialog
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

function LiveConfirmDialog({
  onCancel,
  onConfirm,
}: {
  onCancel: () => void;
  onConfirm: () => void;
}) {
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
          Switch to LIVE real-money account?
        </h2>
        <p className="mt-2 text-sm text-[var(--color-muted)]">
          Live mode operates on the real ~$10,000 Alpaca account. Stat tiles,
          positions, and orders will reflect real trades. You will not be asked
          again this session.
        </p>
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
