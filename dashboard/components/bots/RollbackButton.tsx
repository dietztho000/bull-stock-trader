"use client";

import useSWR, { mutate } from "swr";
import { useState } from "react";
import { fmtDateTimeCT } from "@/lib/time";

type Candidate = {
  sourceBotId: string;
  targetBotId: string;
  ts: string;
  added: number;
  removed: number;
  priorContentBytes: number;
  priorContentPreview: string;
};

const fetcher = (u: string) => fetch(u).then((r) => r.json());

/** Audit F9 — surfaces a "Rollback" link on a bot card when its
 *  TRADING-STRATEGY.md has a recent promote that hasn't been rolled back.
 *  Self-renders to nothing when no candidate exists, so it can be mounted
 *  unconditionally on every card. */
export function RollbackButton({ botId }: { botId: string }) {
  const url = `/api/bots/promote/rollback?targetBotId=${encodeURIComponent(botId)}`;
  const { data, error } = useSWR<{ candidate: Candidate | null }>(url, fetcher, {
    refreshInterval: 60_000,
    revalidateOnFocus: true,
  });
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const candidate = data?.candidate ?? null;
  if (error || !candidate) return null;

  async function onClick() {
    if (!candidate) return;
    const when = fmtDateTimeCT(candidate.ts);
    const ok = window.confirm(
      `Rollback ${botId} to its strategy from before ${candidate.sourceBotId}'s ` +
        `promote on ${when} CT?\n\n` +
        `+${candidate.removed} / -${candidate.added} lines will be reverted ` +
        `(${candidate.priorContentBytes} bytes restored).\n\n` +
        `This appends a TRADE-LOG anchor and a PROMOTION-LOG entry — git ` +
        `history captures both versions.`
    );
    if (!ok) return;
    setSubmitting(true);
    setErrorMsg(null);
    try {
      const res = await fetch("/api/bots/promote/rollback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetBotId: botId,
          confirm: "I-CONFIRM-ROLLBACK",
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      // Re-fetch the candidate (now null for this target) and any open
      // bot views that might display strategy state.
      await mutate(url);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={onClick}
        disabled={submitting}
        className="text-[11px] text-amber-300 hover:text-amber-200 hover:underline disabled:opacity-50"
        title={`Revert ${botId}'s strategy to before ${candidate.sourceBotId}'s promote`}
      >
        {submitting ? "Rolling back…" : "Rollback ←"}
      </button>
      {errorMsg ? (
        <span className="text-[10px] text-rose-300" title={errorMsg}>
          failed
        </span>
      ) : null}
    </div>
  );
}
