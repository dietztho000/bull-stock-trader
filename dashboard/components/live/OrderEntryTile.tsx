"use client";

import { useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import clsx from "clsx";
import { Card, Badge } from "@/components/ui/Card";
import { useAccountSummary } from "@/components/live/useAccountSummary";
import { useSettingsOptional } from "@/components/providers/SettingsProvider";
import { useTradingAccountOptional } from "@/lib/tradingAccountContext";
import { useStrategyState } from "@/lib/useStrategyState";
import { useToastOptional } from "@/components/providers/ToastProvider";
import { targetPctForScore } from "@/lib/stats/sizing";
import { fmtMoney, fmtPct } from "@/lib/format";
import { DEFAULTS } from "@/lib/settings.schema";
import { SymbolAutocomplete } from "./SymbolAutocomplete";

type Side = "buy" | "sell";

const SYMBOL_RE = /^[A-Z]{1,5}$/;

const fetcher = (u: string) => fetch(u).then((r) => r.json());

/** Order entry tile — reads conviction score, applies rule #19 sizing math,
 *  and runs every active rule check before allowing submit. Live submissions
 *  require an explicit "I-CONFIRM-LIVE" string in the confirmation flow. */
export function OrderEntryTile() {
  const ctx = useTradingAccountOptional();
  const settingsCtx = useSettingsOptional();
  const strategy = settingsCtx?.settings.strategy ?? DEFAULTS.strategy;
  const account = useAccountSummary();
  const { data: state } = useStrategyState();
  const toast = useToastOptional();
  const mode = ctx?.account ?? "paper";
  const accountId = ctx?.accountId ?? null;
  const bot = ctx?.bot ?? null;
  const botId = ctx?.botId ?? null;
  const allocation = bot?.allocation ?? null;

  // For allocated bots, sizing must use the bot's $ slice — not the whole
  // account's equity (audit 7.10 — "$10k slice, score 9 → $18k order"). Pull
  // virtual equity from the bot endpoint and prefer it whenever available.
  const { data: virtualEq } = useSWR<{ equity: number } | { error: string }>(
    botId && allocation != null ? `/api/bots/${botId}/equity` : null,
    fetcher,
    { refreshInterval: 30_000, revalidateOnFocus: false, keepPreviousData: true }
  );

  const [symbol, setSymbol] = useState("");
  const [score, setScore] = useState<number>(7);
  const [side, setSide] = useState<Side>("buy");
  const [estPrice, setEstPrice] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [confirmStep, setConfirmStep] = useState<"idle" | "review" | "live-confirm">("idle");
  const [liveConfirmText, setLiveConfirmText] = useState("");

  // Pre-fill from ?prefill=SYM&score=N (set by "Trade this idea" CTA).
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const ps = params.get("prefill")?.toUpperCase();
    const sc = params.get("score");
    if (ps && SYMBOL_RE.test(ps)) setSymbol(ps);
    const n = sc ? Number(sc) : NaN;
    if (Number.isFinite(n) && n >= 0 && n <= 10) setScore(n);
  }, []);

  const rawEquity =
    account.loading || "error" in account ? null : account.equity;
  const virtualEquity =
    virtualEq && !("error" in virtualEq) ? virtualEq.equity : null;
  const equity =
    allocation != null ? virtualEquity : rawEquity;
  const equitySource: "virtual" | "raw" | null =
    equity == null ? null : allocation != null ? "virtual" : "raw";
  const targetPct = useMemo(() => targetPctForScore(score), [score]);
  const targetUsd =
    equity != null && targetPct != null ? equity * targetPct : null;
  const priceNum = Number(estPrice);
  const estShares =
    targetUsd != null && Number.isFinite(priceNum) && priceNum > 0
      ? Math.max(1, Math.floor(targetUsd / priceNum))
      : null;

  const violations = useMemo(() => {
    const out: { code: string; message: string; severity: "block" | "warn" }[] = [];
    if (!SYMBOL_RE.test(symbol) && symbol.length > 0) {
      out.push({ code: "symbol", message: "Symbol must be 1-5 uppercase letters", severity: "block" });
    }
    if (side === "buy") {
      if (score < strategy.entryScoreMin) {
        out.push({
          code: "score",
          message: `Entry score ${score} < rule #19 floor ${strategy.entryScoreMin}.`,
          severity: "block",
        });
      }
      if (state) {
        if (state.slotsUsed >= state.slotsCap) {
          out.push({
            code: "slots",
            message: `All ${state.slotsCap} slots used.`,
            severity: "block",
          });
        }
        const cooldown = state.cooldownSymbols.find((c) => c.symbol === symbol);
        if (cooldown) {
          out.push({
            code: "cooldown",
            message: `${symbol} cooldown — unlocks in ${cooldown.daysRemaining}d (rule #20).`,
            severity: "block",
          });
        }
        const earningsHit = state.earningsT2Held.find((e) => e.symbol === symbol);
        if (earningsHit) {
          out.push({
            code: "earnings",
            message: `${symbol} earnings in ${earningsHit.daysUntil}d (rule #13).`,
            severity: "block",
          });
        }
        // Sector-cap check: matching ideas in blockedIdeas would already cover
        // this, but flag here too in case the user types a symbol not in
        // research log.
        const blockedIdea = state.blockedIdeas.find((i) => i.symbol === symbol);
        if (blockedIdea) {
          const ruleNum =
            blockedIdea.reason === "sector-cap"
              ? "17"
              : blockedIdea.reason === "cooldown"
                ? "20"
                : "13";
          out.push({
            code: blockedIdea.reason,
            message: `${symbol}: ${blockedIdea.detail} (rule #${ruleNum}).`,
            severity: "block",
          });
        }
      }
    }
    return out;
  }, [symbol, score, side, state, strategy]);

  const blocking = violations.some((v) => v.severity === "block");
  const ready =
    SYMBOL_RE.test(symbol) &&
    estShares != null &&
    !blocking &&
    !submitting &&
    equity != null;

  function reset() {
    setConfirmStep("idle");
    setLiveConfirmText("");
  }

  async function submit() {
    if (!ready) return;
    if (estShares == null) return;
    setSubmitting(true);
    try {
      // Prefer the bot's bound accountId so the order routes through the
      // encrypted vault and the client_order_id picks up the bot prefix
      // for soft-allocation P&L attribution. Fall back to legacy mode only
      // when we don't have a registry binding (e.g. fresh install).
      const body: Record<string, unknown> = {
        symbol,
        qty: estShares,
        side,
        type: "market",
        tif: "day",
      };
      if (accountId) {
        body.accountId = accountId;
        if (botId) body.botId = botId;
      } else {
        body.mode = mode;
      }
      if (mode === "live") {
        body.confirmLive = liveConfirmText;
      }
      const resp = await fetch("/api/alpaca/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await resp.json();
      if (!resp.ok) {
        toast?.push({
          tone: "error",
          title: "Order rejected",
          detail: data?.error ?? `HTTP ${resp.status}`,
        });
        return;
      }
      toast?.push({
        tone: "success",
        title: `${side === "buy" ? "Bought" : "Sold"} ${estShares} ${symbol} (${mode})`,
        detail: `Score ${score} · target ${targetPct != null ? fmtPct(targetPct * 100) : "—"} of equity`,
      });
      setSymbol("");
      reset();
    } catch (err) {
      toast?.push({
        tone: "error",
        title: "Order failed",
        detail: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card
      title="Order entry"
      subtitle={
        mode === "live"
          ? "🔴 LIVE — submission affects real capital."
          : "🟡 Paper — sandbox, no real capital at risk."
      }
    >
      <div className="space-y-3">
        <div className="grid grid-cols-3 gap-2">
          <Field label="Symbol">
            <SymbolAutocomplete
              value={symbol}
              onChange={setSymbol}
              placeholder="AAPL"
              className="w-full px-2.5 py-1.5 rounded-lg glass font-mono text-xs uppercase"
            />
          </Field>
          <Field label="Side">
            <select
              value={side}
              onChange={(e) => setSide(e.target.value as Side)}
              className="w-full px-2.5 py-1.5 rounded-lg glass text-xs cursor-pointer"
            >
              <option value="buy">Buy</option>
              <option value="sell">Sell</option>
            </select>
          </Field>
          <Field label="Score (rule #19)">
            <input
              type="number"
              min={0}
              max={10}
              value={score}
              onChange={(e) =>
                setScore(Math.max(0, Math.min(10, Number(e.target.value) || 0)))
              }
              className="w-full px-2.5 py-1.5 rounded-lg glass tabular text-xs"
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Field label="Est. price (auto-sized)">
            <input
              type="number"
              step="0.01"
              min={0}
              value={estPrice}
              onChange={(e) => setEstPrice(e.target.value)}
              placeholder="0.00"
              className="w-full px-2.5 py-1.5 rounded-lg glass tabular text-xs"
            />
          </Field>
          <Field label="Target (rule #19)">
            <div className="text-xs tabular pt-1.5">
              {targetPct != null
                ? `${fmtPct(targetPct * 100)} ≈ ${
                    targetUsd != null ? fmtMoney(targetUsd) : "—"
                  }`
                : "—"}
            </div>
          </Field>
        </div>

        {equitySource === "virtual" && allocation != null && (
          <div className="text-[10px] text-[var(--color-muted)] tabular">
            Sizing against virtual equity {fmtMoney(equity ?? 0)} · slice {fmtMoney(allocation)}
          </div>
        )}

        {estShares != null && (
          <div className="text-[11px] text-[var(--color-muted)] tabular">
            Estimated order: {estShares.toLocaleString()} sh × {fmtMoney(priceNum)} ={" "}
            {fmtMoney(estShares * priceNum)}
          </div>
        )}

        {violations.length > 0 && (
          <div className="rounded-lg border border-[var(--color-down)]/30 bg-[var(--color-down)]/10 p-2.5 space-y-1">
            <div className="text-[10px] uppercase tracking-[0.14em] text-[var(--color-down)] font-semibold">
              Rule check
            </div>
            <ul className="space-y-0.5">
              {violations.map((v) => (
                <li key={v.code} className="text-[11px] flex items-baseline gap-1.5">
                  <Badge tone={v.severity === "block" ? "down" : "warn"}>
                    {v.severity === "block" ? "blocked" : "warn"}
                  </Badge>
                  <span>{v.message}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {confirmStep === "idle" && (
          <button
            type="button"
            onClick={() => setConfirmStep("review")}
            disabled={!ready}
            className={clsx(
              "w-full py-2 rounded-full text-sm font-semibold",
              ready
                ? "glass glass-interactive glass-tint-accent"
                : "glass opacity-50 cursor-not-allowed"
            )}
          >
            Review order
          </button>
        )}

        {confirmStep === "review" && (
          <div className="rounded-lg border border-[var(--color-accent)]/30 bg-[var(--color-accent)]/5 p-3 space-y-2">
            <div className="text-xs">
              <strong>{side.toUpperCase()}</strong> {estShares} {symbol} @ market in{" "}
              <strong>{mode === "live" ? "LIVE" : "PAPER"}</strong> mode.
            </div>
            {mode === "live" ? (
              <div>
                <label className="text-[11px] text-[var(--color-warn)] block mb-1">
                  Type <code>I-CONFIRM-LIVE</code> to authorize:
                </label>
                <input
                  type="text"
                  value={liveConfirmText}
                  onChange={(e) => setLiveConfirmText(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-lg glass font-mono text-xs"
                />
              </div>
            ) : null}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={submit}
                disabled={submitting || (mode === "live" && liveConfirmText !== "I-CONFIRM-LIVE")}
                className={clsx(
                  "flex-1 py-1.5 rounded-full text-xs font-semibold",
                  "glass glass-interactive",
                  mode === "live" ? "glass-tint-down" : "glass-tint-accent",
                  (submitting || (mode === "live" && liveConfirmText !== "I-CONFIRM-LIVE")) &&
                    "opacity-50 cursor-not-allowed"
                )}
              >
                {submitting ? "Submitting…" : `Submit ${side} (${mode})`}
              </button>
              <button
                type="button"
                onClick={reset}
                className="px-4 py-1.5 rounded-full text-xs glass glass-interactive"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-[0.14em] text-[var(--color-muted)] font-medium mb-1">
        {label}
      </div>
      {children}
    </div>
  );
}
