"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { useAccountSummary } from "@/components/live/useAccountSummary";
import { fmtSignedMoney, fmtRelativeTime, colorOf, fmtPct } from "@/lib/format";
import { useTradingAccountOptional } from "@/lib/tradingAccountContext";

/** Audit NF5 — surfaces what's changed since the user's previous visit
 *  to the dashboard. Stored in localStorage keyed by accountId so a user
 *  switching between paper-100k and live doesn't see deltas computed
 *  against the wrong baseline.
 *
 *  Snapshot is updated 10s after mount (not immediately) so brief
 *  reloads/router.refresh() ticks don't reset the baseline. First visit
 *  for an account hides the card entirely. */
type Snapshot = { ts: number; equity: number };

const STORAGE_KEY_PREFIX = "dashboard:lastVisit:";
const COMMIT_DELAY_MS = 10_000;
const MIN_AGE_MS = 5 * 60_000; // hide for <5min freshness — not interesting

function storageKey(accountId: string | null, mode: string | undefined): string {
  return `${STORAGE_KEY_PREFIX}${accountId ?? mode ?? "default"}`;
}

function readSnapshot(key: string): Snapshot | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Snapshot;
    if (
      typeof parsed.ts !== "number" ||
      typeof parsed.equity !== "number" ||
      !Number.isFinite(parsed.ts) ||
      !Number.isFinite(parsed.equity)
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function writeSnapshot(key: string, snap: Snapshot) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(snap));
  } catch {
    // quota / storage disabled — silent skip, baseline stays stale
  }
}

export function SinceLastVisitTile() {
  const ctx = useTradingAccountOptional();
  const summary = useAccountSummary();
  // Capture the snapshot once on first non-loading render so subsequent
  // changes (the 5s SWR poll) don't shift the displayed delta.
  const [previous, setPrevious] = useState<Snapshot | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHydrated(true);
    const key = storageKey(ctx?.accountId ?? null, ctx?.account);
    setPrevious(readSnapshot(key));
  }, [ctx?.accountId, ctx?.account]);

  // Commit a fresh snapshot 10s after mount so quick refreshes don't
  // reset the baseline. The captured `previous` stays for the lifetime
  // of this tile so the user keeps seeing their delta.
  useEffect(() => {
    if (!hydrated || summary.loading || "error" in summary) return;
    const key = storageKey(ctx?.accountId ?? null, ctx?.account);
    const t = setTimeout(() => {
      writeSnapshot(key, { ts: Date.now(), equity: summary.equity });
    }, COMMIT_DELAY_MS);
    return () => clearTimeout(t);
  }, [hydrated, summary, ctx?.accountId, ctx?.account]);

  if (!hydrated) return null;
  if (summary.loading || "error" in summary) return null;
  if (!previous) return null;

  const ageMs = Date.now() - previous.ts;
  if (ageMs < MIN_AGE_MS) return null;

  const equityDelta = summary.equity - previous.equity;
  const equityPct =
    previous.equity > 0 ? (equityDelta / previous.equity) * 100 : 0;

  return (
    <Card
      title="Since last visit"
      subtitle={`${fmtRelativeTime(previous.ts)} ago`}
    >
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <div className="text-[10px] uppercase tracking-[0.14em] text-[var(--color-muted)]">
            Equity Δ
          </div>
          <div
            className={
              colorOf(equityDelta) === true
                ? "text-lg font-semibold tabular text-[var(--color-up)]"
                : colorOf(equityDelta) === false
                ? "text-lg font-semibold tabular text-[var(--color-down)]"
                : "text-lg font-semibold tabular"
            }
          >
            {fmtSignedMoney(equityDelta)}
          </div>
          <div className="text-[10px] text-[var(--color-muted)] mt-0.5">
            {equityPct >= 0 ? "+" : ""}
            {fmtPct(equityPct)} from {fmtSignedMoney(previous.equity).replace(/^\+/, "")}
          </div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-[0.14em] text-[var(--color-muted)]">
            Today's P&L
          </div>
          <div
            className={
              colorOf(summary.dayPnl) === true
                ? "text-lg font-semibold tabular text-[var(--color-up)]"
                : colorOf(summary.dayPnl) === false
                ? "text-lg font-semibold tabular text-[var(--color-down)]"
                : "text-lg font-semibold tabular"
            }
          >
            {fmtSignedMoney(summary.dayPnl)}
          </div>
          <div className="text-[10px] text-[var(--color-muted)] mt-0.5">
            {fmtPct(summary.dayPct)}
          </div>
        </div>
      </div>
    </Card>
  );
}
