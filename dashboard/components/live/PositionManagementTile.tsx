"use client";

import useSWR from "swr";
import { useState } from "react";
import clsx from "clsx";
import { Card, Badge } from "@/components/ui/Card";
import { useLiveSwr } from "@/lib/useLiveSwr";
import { useTradingAccountOptional } from "@/lib/tradingAccountContext";
import { alpacaApiUrl } from "@/lib/alpacaMode";
import { useToastOptional } from "@/components/providers/ToastProvider";
import {
  type AlpacaPosition,
  type AlpacaOrder,
  type AlpacaErrorEnvelope,
  isAlpacaError,
} from "@/lib/types/alpaca";
import { fmtMoney, fmtSignedMoney, fmtPct } from "@/lib/format";

const fetcher = (u: string) => fetch(u).then((r) => r.json());

type ActionState =
  | { kind: "idle" }
  | { kind: "confirm-close"; symbol: string; live: string; symbolConfirm: string }
  | { kind: "confirm-tighten"; orderId: string; symbol: string; trailPct: number; live: string }
  | { kind: "running" };

export function PositionManagementTile() {
  const ctx = useTradingAccountOptional();
  const mode = ctx?.account ?? "paper";
  const accountId = ctx?.accountId ?? null;
  const botId = ctx?.botId ?? null;
  const idOpts = accountId ? { accountId } : { mode };
  const liveOpts = useLiveSwr(5000);
  const toast = useToastOptional();
  const [action, setAction] = useState<ActionState>({ kind: "idle" });

  const { data: positionsData, mutate: refreshPositions } = useSWR<
    AlpacaPosition[] | AlpacaErrorEnvelope
  >(alpacaApiUrl("positions", idOpts), fetcher, liveOpts);
  const { data: ordersData, mutate: refreshOrders } = useSWR<
    AlpacaOrder[] | AlpacaErrorEnvelope
  >(alpacaApiUrl("orders", idOpts), fetcher, liveOpts);

  if (!positionsData || isAlpacaError(positionsData)) {
    return (
      <Card title="Position management">
        <div className="text-xs text-[var(--color-muted)]">
          Positions unavailable.
        </div>
      </Card>
    );
  }
  const positions = positionsData;
  const orders = Array.isArray(ordersData) ? ordersData : [];

  if (positions.length === 0) {
    return (
      <Card title="Position management" subtitle="No open positions to manage.">
        <div className="text-xs text-[var(--color-muted)]">
          New entries land via the Order entry tile.
        </div>
      </Card>
    );
  }

  function trailingStopFor(symbol: string): AlpacaOrder | null {
    return (
      orders.find(
        (o) => o.symbol === symbol && o.type === "trailing_stop" && o.status === "new"
      ) ?? null
    );
  }

  async function close(symbol: string, confirmLive: string) {
    setAction({ kind: "running" });
    try {
      const body: Record<string, unknown> = { symbol, confirmLive };
      if (accountId) {
        body.accountId = accountId;
        if (botId) body.botId = botId;
      } else {
        body.mode = mode;
      }
      const resp = await fetch("/api/alpaca/close", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await resp.json();
      if (!resp.ok) {
        toast?.push({ tone: "error", title: `Close ${symbol} failed`, detail: data?.error });
        return;
      }
      toast?.push({ tone: "success", title: `Close requested for ${symbol}` });
      void refreshPositions();
      void refreshOrders();
    } catch (err) {
      toast?.push({
        tone: "error",
        title: `Close ${symbol} failed`,
        detail: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setAction({ kind: "idle" });
    }
  }

  async function tighten(
    orderId: string,
    symbol: string,
    trailPct: number,
    confirmLive: string
  ) {
    setAction({ kind: "running" });
    try {
      const body: Record<string, unknown> = {
        orderId,
        trailPercent: trailPct,
        confirmLive,
      };
      if (accountId) {
        body.accountId = accountId;
        if (botId) body.botId = botId;
      } else {
        body.mode = mode;
      }
      const resp = await fetch("/api/alpaca/order", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await resp.json();
      if (!resp.ok) {
        toast?.push({ tone: "error", title: `Tighten ${symbol} failed`, detail: data?.error });
        return;
      }
      toast?.push({
        tone: "success",
        title: `${symbol} trail tightened to ${trailPct}%`,
      });
      void refreshOrders();
    } catch (err) {
      toast?.push({
        tone: "error",
        title: `Tighten ${symbol} failed`,
        detail: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setAction({ kind: "idle" });
    }
  }

  return (
    <Card
      title="Position management"
      subtitle={`${mode === "live" ? "🔴 LIVE — actions affect real capital." : "🟡 Paper — sandbox."}`}
    >
      <div className="space-y-2.5">
        {positions.map((p) => {
          const pct = Number(p.unrealized_plpc) * 100;
          const pl = Number(p.unrealized_pl);
          const ts = trailingStopFor(p.symbol);
          const currentTrail = ts?.trail_percent ? Number(ts.trail_percent) : null;

          return (
            <div
              key={p.symbol}
              className="rounded-lg p-2.5 border border-[rgba(255,255,255,0.06)]"
            >
              <div className="flex items-baseline justify-between gap-2 flex-wrap">
                <div className="flex items-baseline gap-2">
                  <span className="font-semibold tabular text-sm">{p.symbol}</span>
                  <span className="text-[11px] text-[var(--color-muted)] tabular">
                    {Number(p.qty).toLocaleString()} @ {fmtMoney(Number(p.avg_entry_price))}
                  </span>
                </div>
                <div className="flex items-baseline gap-2 text-xs tabular">
                  <span
                    className={clsx(
                      pct > 0 && "text-[var(--color-up)]",
                      pct < 0 && "text-[var(--color-down)]"
                    )}
                  >
                    {fmtSignedMoney(pl)} ({fmtPct(pct)})
                  </span>
                </div>
              </div>

              <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                {currentTrail != null ? (
                  <Badge tone="neutral">trail {currentTrail.toFixed(1)}%</Badge>
                ) : (
                  <Badge tone="warn">no trail</Badge>
                )}
                {ts?.id && pct >= 15 && currentTrail != null && currentTrail > 7 && (
                  <button
                    type="button"
                    onClick={() =>
                      setAction({
                        kind: "confirm-tighten",
                        orderId: ts.id ?? "",
                        symbol: p.symbol,
                        trailPct: pct >= 20 ? 5 : 7,
                        live: "",
                      })
                    }
                    className="glass glass-interactive rounded-full px-2.5 py-1 text-[11px] font-medium"
                  >
                    Tighten trail to {pct >= 20 ? 5 : 7}%
                  </button>
                )}
                <button
                  type="button"
                  onClick={() =>
                    setAction({
                      kind: "confirm-close",
                      symbol: p.symbol,
                      live: "",
                      symbolConfirm: "",
                    })
                  }
                  className="glass glass-interactive glass-tint-down rounded-full pl-2 pr-2.5 py-1 text-[11px] font-semibold border border-[var(--color-down)]/40 hover:border-[var(--color-down)]"
                  title="Submits a market sell — destructive"
                >
                  <span className="mr-1" aria-hidden>⚠</span>
                  Force exit
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {action.kind === "confirm-close" && (
        <ConfirmModal
          title={`Close all of ${action.symbol}?`}
          subtitle="Submits a market sell — irreversible once filled."
          mode={mode}
          confirmLive={action.live}
          setConfirmLive={(v) => setAction({ ...action, live: v })}
          destructive
          extraConfirm={{
            label: `Type ${action.symbol} to confirm:`,
            value: action.symbolConfirm,
            expected: action.symbol,
            onChange: (v) => setAction({ ...action, symbolConfirm: v }),
          }}
          onConfirm={() => close(action.symbol, action.live)}
          onCancel={() => setAction({ kind: "idle" })}
          dangerLabel="Submit market close"
        />
      )}
      {action.kind === "confirm-tighten" && (
        <ConfirmModal
          title={`Tighten ${action.symbol} trail to ${action.trailPct}%?`}
          subtitle="Lowers the trailing-stop ratchet — preventative, no immediate trade."
          mode={mode}
          confirmLive={action.live}
          setConfirmLive={(v) => setAction({ ...action, live: v })}
          onConfirm={() => tighten(action.orderId, action.symbol, action.trailPct, action.live)}
          onCancel={() => setAction({ kind: "idle" })}
          dangerLabel="Replace trail"
        />
      )}
    </Card>
  );
}

function ConfirmModal({
  title,
  subtitle,
  mode,
  confirmLive,
  setConfirmLive,
  onConfirm,
  onCancel,
  dangerLabel,
  destructive = false,
  extraConfirm,
}: {
  title: string;
  subtitle?: string;
  mode: "paper" | "live";
  confirmLive: string;
  setConfirmLive: (v: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
  dangerLabel: string;
  /** When true, the modal renders with a heavy red border / scary header
   *  and (combined with `extraConfirm`) requires typing the symbol —
   *  matches the U11 audit ask to differentiate destructive actions from
   *  preventative ones like trail tightening. */
  destructive?: boolean;
  /** Optional symbol-typing gate for destructive confirms. Disabled
   *  submission until `value === expected`. */
  extraConfirm?: {
    label: string;
    value: string;
    expected: string;
    onChange: (v: string) => void;
  };
}) {
  const liveReady = mode !== "live" || confirmLive === "I-CONFIRM-LIVE";
  const extraReady =
    !extraConfirm || extraConfirm.value.trim().toUpperCase() === extraConfirm.expected.toUpperCase();
  const ready = liveReady && extraReady;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div
        className={clsx(
          "w-full max-w-md rounded-2xl glass p-5",
          destructive && "border border-[var(--color-down)] glass-tint-down"
        )}
      >
        <div className="text-base font-semibold flex items-center gap-2">
          {destructive && (
            <span className="text-[var(--color-down)]" aria-hidden>
              ⚠
            </span>
          )}
          {title}
        </div>
        {subtitle && (
          <div
            className={clsx(
              "mt-1 text-[11px]",
              destructive ? "text-[var(--color-down)]" : "text-[var(--color-muted)]"
            )}
          >
            {subtitle}
          </div>
        )}
        <div className="mt-2 text-xs text-[var(--color-muted)]">
          Mode: <strong>{mode === "live" ? "🔴 LIVE" : "🟡 Paper"}</strong>
        </div>
        {extraConfirm && (
          <div className="mt-3">
            <label className="text-[11px] text-[var(--color-down)] block mb-1">
              {extraConfirm.label}
            </label>
            <input
              type="text"
              value={extraConfirm.value}
              onChange={(e) => extraConfirm.onChange(e.target.value)}
              autoFocus
              className="w-full px-2.5 py-1.5 rounded-lg glass font-mono text-xs uppercase"
            />
          </div>
        )}
        {mode === "live" && (
          <div className="mt-3">
            <label className="text-[11px] text-[var(--color-warn)] block mb-1">
              Type <code>I-CONFIRM-LIVE</code> to authorize:
            </label>
            <input
              type="text"
              value={confirmLive}
              onChange={(e) => setConfirmLive(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-lg glass font-mono text-xs"
              autoFocus
            />
          </div>
        )}
        <div className="mt-4 flex items-center gap-2 justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="glass glass-interactive rounded-full px-4 py-1.5 text-xs font-semibold"
            autoFocus={destructive && !extraConfirm && mode !== "live"}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={!ready}
            className={clsx(
              "glass glass-interactive rounded-full px-4 py-1.5 text-xs font-semibold",
              destructive
                ? "glass-tint-down border border-[var(--color-down)]"
                : "glass-tint-warn",
              !ready && "opacity-50 cursor-not-allowed"
            )}
          >
            {dangerLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
