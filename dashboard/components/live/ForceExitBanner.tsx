"use client";

import { useState } from "react";
import clsx from "clsx";
import { Card } from "@/components/ui/Card";
import { useTradingAccountOptional } from "@/lib/tradingAccountContext";
import { useToastOptional } from "@/components/providers/ToastProvider";

/** Renders only when a `?force=SYMBOL` query param is present (set by the
 *  earnings-gate banner / calendar CTA). Confirms + closes the position. */
export function ForceExitBanner({ symbol }: { symbol: string }) {
  const ctx = useTradingAccountOptional();
  const mode = ctx?.account ?? "paper";
  const toast = useToastOptional();
  const [confirmLive, setConfirmLive] = useState("");
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);

  const liveReady = mode !== "live" || confirmLive === "I-CONFIRM-LIVE";

  async function close() {
    setRunning(true);
    try {
      const resp = await fetch("/api/alpaca/close", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbol, mode, confirmLive }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        toast?.push({
          tone: "error",
          title: `Close ${symbol} failed`,
          detail: data?.error,
        });
        return;
      }
      toast?.push({ tone: "success", title: `Close requested for ${symbol}` });
      setDone(true);
    } catch (err) {
      toast?.push({
        tone: "error",
        title: `Close ${symbol} failed`,
        detail: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setRunning(false);
    }
  }

  if (done) {
    return (
      <Card title={`Force-exit submitted for ${symbol}`}>
        <div className="text-xs text-[var(--color-up)]">
          ✓ Market close request sent to {mode === "live" ? "live" : "paper"} account.
          Verify on the Positions tile.
        </div>
      </Card>
    );
  }

  return (
    <Card
      title={`Force-exit requested: ${symbol}`}
      subtitle="Linked from earnings-gate / calendar CTA. Confirm to send a market close."
    >
      <div className="space-y-2.5 text-xs">
        <div>
          Mode: <strong>{mode === "live" ? "🔴 LIVE" : "🟡 Paper"}</strong>
        </div>
        {mode === "live" && (
          <div>
            <label className="text-[11px] text-[var(--color-warn)] block mb-1">
              Type <code>I-CONFIRM-LIVE</code> to authorize:
            </label>
            <input
              type="text"
              value={confirmLive}
              onChange={(e) => setConfirmLive(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-lg glass font-mono text-xs"
            />
          </div>
        )}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={close}
            disabled={!liveReady || running}
            className={clsx(
              "glass glass-interactive glass-tint-down rounded-full px-4 py-1.5 text-xs font-semibold",
              (!liveReady || running) && "opacity-50 cursor-not-allowed"
            )}
          >
            {running ? "Submitting…" : `Close ${symbol} at market`}
          </button>
        </div>
      </div>
    </Card>
  );
}
