"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import clsx from "clsx";
import type { Bot } from "@/lib/settings";

const fetcher = (u: string) => fetch(u).then((r) => r.json());

type ParamKey =
  | "ladderThreshold"
  | "defaultTrail"
  | "trailTightenAt15"
  | "trailTightenAt20"
  | "gapExitPct";

const PARAM_LABELS: Record<ParamKey, { label: string; hint: string; step: number; min: number; max: number }> = {
  ladderThreshold: {
    label: "Ladder fires at +%",
    hint: "Default 20 — sell half at this gain",
    step: 0.01,
    min: 0.05,
    max: 1,
  },
  defaultTrail: {
    label: "Initial trail %",
    hint: "Default 10",
    step: 0.005,
    min: 0.02,
    max: 0.5,
  },
  trailTightenAt15: {
    label: "Trail at +15%",
    hint: "Default 7",
    step: 0.005,
    min: 0.02,
    max: 0.3,
  },
  trailTightenAt20: {
    label: "Trail at +20%",
    hint: "Default 5",
    step: 0.005,
    min: 0.02,
    max: 0.3,
  },
  gapExitPct: {
    label: "Gap exit at %",
    hint: "Default -7",
    step: 0.005,
    min: -0.2,
    max: 0,
  },
};

const PARAM_KEYS = Object.keys(PARAM_LABELS) as ParamKey[];

/** Cross-bot backtest control (audit F8). Surfaces tweakable exit-rule
 *  parameters AND a "trade source" selector so users can replay any bot's
 *  history against arbitrary rule overrides — answering "would this trail
 *  ratchet have beaten my live bot YTD?" without forking the engine. */
export function CrossBotBacktestPanel({
  defaultBotId,
}: {
  /** The currently-selected bot in the page URL — used as the default
   *  trade source AND strategy-provenance bot. */
  defaultBotId: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [tradeSource, setTradeSource] = useState(defaultBotId);
  const [strategyBot, setStrategyBot] = useState(defaultBotId);
  const [overrides, setOverrides] = useState<Partial<Record<ParamKey, number>>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastRunSummary, setLastRunSummary] = useState<string | null>(null);

  const botsResp = useSWR<{ bots: Bot[] }>("/api/bots", fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 30_000,
  });
  const bots = botsResp.data?.bots ?? [];
  const enabledBots = bots.filter((b) => b.enabled);

  function setOverride(key: ParamKey, raw: string) {
    if (raw === "") {
      const next = { ...overrides };
      delete next[key];
      setOverrides(next);
      return;
    }
    const num = Number(raw);
    if (!Number.isFinite(num)) return;
    setOverrides({ ...overrides, [key]: num });
  }

  async function run() {
    setBusy(true);
    setError(null);
    setLastRunSummary(null);
    try {
      const params = Object.keys(overrides).length > 0 ? overrides : undefined;
      const body: Record<string, unknown> = {};
      if (params) body.params = params;
      if (strategyBot) body.strategyBot = strategyBot;

      const resp = await fetch(
        `/api/backtest/run?bot=${encodeURIComponent(tradeSource)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      );
      const data = await resp.json();
      if (!resp.ok) {
        setError(data?.error ?? `HTTP ${resp.status}`);
        return;
      }
      setLastRunSummary(
        `Replayed ${data.summary.tradeCount} trades · sim ${
          data.summary.totalSimPnl >= 0 ? "+" : ""
        }${data.summary.totalSimPnl.toFixed(0)} vs actual ${
          data.summary.totalActualPnl >= 0 ? "+" : ""
        }${data.summary.totalActualPnl.toFixed(0)} · delta ${
          data.summary.pnlDelta >= 0 ? "+" : ""
        }${data.summary.pnlDelta.toFixed(0)}`
      );
      // Refresh the page tree so the cached snapshot view picks up the new
      // run — the snapshot is keyed by tradeSource bot's memory dir.
      startTransition(() => router.refresh());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <details
      open={open}
      onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}
      className="frost rounded-2xl no-drag"
    >
      <summary className="cursor-pointer select-none px-5 py-3 flex items-center justify-between text-sm">
        <span className="text-[11px] font-semibold tracking-[0.12em] uppercase text-[var(--color-muted)]">
          Cross-bot run
        </span>
        <span className="text-[10px] text-[var(--color-muted)]">
          Replay another bot&apos;s trades · tweak exit rules
        </span>
      </summary>
      <div className="px-5 pb-5 space-y-3 text-sm">
        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="Trade source bot" hint="Whose closed trades to replay">
            <select
              value={tradeSource}
              onChange={(e) => setTradeSource(e.target.value)}
              className={inputClass}
            >
              {enabledBots.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} ({b.id})
                </option>
              ))}
            </select>
          </Field>
          <Field
            label="Strategy provenance"
            hint="Recorded in the snapshot so you can tell runs apart"
          >
            <select
              value={strategyBot}
              onChange={(e) => setStrategyBot(e.target.value)}
              className={inputClass}
            >
              {enabledBots.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
              <option value="custom">custom</option>
            </select>
          </Field>
        </div>

        <div className="text-[10px] uppercase tracking-[0.14em] text-[var(--color-muted)] font-semibold pt-1">
          Exit-rule overrides
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {PARAM_KEYS.map((key) => {
            const meta = PARAM_LABELS[key];
            const value = overrides[key];
            return (
              <Field key={key} label={meta.label} hint={meta.hint}>
                <input
                  type="number"
                  step={meta.step}
                  min={meta.min}
                  max={meta.max}
                  value={value ?? ""}
                  onChange={(e) => setOverride(key, e.target.value)}
                  placeholder="default"
                  className={inputClass}
                />
              </Field>
            );
          })}
        </div>

        {error && <div className="text-xs text-[var(--color-down)]">{error}</div>}
        {lastRunSummary && (
          <div className="text-xs text-[var(--color-up)]">{lastRunSummary}</div>
        )}

        <div className="flex items-center justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={() => setOverrides({})}
            disabled={busy || Object.keys(overrides).length === 0}
            className="text-xs underline underline-offset-2 disabled:opacity-50"
          >
            Reset overrides
          </button>
          <button
            type="button"
            onClick={run}
            disabled={busy || pending}
            className={clsx(
              "glass glass-tint-accent rounded-full px-3 py-1.5 text-xs font-semibold",
              (busy || pending) && "opacity-50 cursor-not-allowed"
            )}
          >
            {busy ? "Running…" : pending ? "Refreshing…" : "Run with overrides"}
          </button>
        </div>
      </div>
    </details>
  );
}

const inputClass =
  "w-full rounded-lg bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.08)] px-3 py-1.5 text-sm focus:outline-none focus:border-[var(--color-accent)]";

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block text-xs">
      <div className="font-semibold mb-1">{label}</div>
      {children}
      {hint && (
        <div className="text-[10px] text-[var(--color-muted)] mt-1">{hint}</div>
      )}
    </label>
  );
}
