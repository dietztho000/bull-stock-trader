"use client";

import { useEffect, useRef } from "react";
import { useStrategyState } from "./useStrategyState";
import { useSettingsOptional } from "@/components/providers/SettingsProvider";
import { useToastOptional } from "@/components/providers/ToastProvider";
import { useTradingAccountOptional } from "./tradingAccountContext";
import type { AlertRule } from "./settings.schema";

/** Mounted once globally — watches strategy state vs the user's alert rules
 *  and pushes toasts when conditions are newly met. Discord/ntfy delivery is
 *  fanned out via the server-side dispatcher at /api/alerts/dispatch (audit
 *  F8) so webhook URLs and ntfy topics stay out of client bundles. Tracks
 *  fired alerts in a Set keyed by `${ruleId}:${signature}` to avoid spamming
 *  on every poll. */
export function useAlertWatcher() {
  const { data: state } = useStrategyState();
  const settings = useSettingsOptional();
  const toast = useToastOptional();
  const tradingAccount = useTradingAccountOptional();
  const firedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!state || !settings || !toast) return;
    const cfg = settings.settings.alerts;
    if (!cfg.enabled) return;

    const seen = new Set<string>();
    const botId = tradingAccount?.botId;

    for (const rule of cfg.rules) {
      if (!rule.enabled) continue;
      const matches = evaluateRule(rule, state);
      for (const match of matches) {
        const key = `${rule.id}:${match.signature}`;
        seen.add(key);
        if (firedRef.current.has(key)) continue;
        firedRef.current.add(key);
        if (rule.channels.toast) {
          toast.push({
            tone: match.tone,
            title: match.title,
            detail: match.detail,
          });
        }
        if (rule.channels.discord || rule.channels.ntfy) {
          dispatchServerSide({
            ruleId: rule.id,
            signature: match.signature,
            title: match.title,
            detail: match.detail,
            channels: {
              discord: rule.channels.discord,
              ntfy: rule.channels.ntfy,
            },
            botId,
          });
        }
      }
    }

    // Garbage-collect signatures that no longer match so they re-fire next
    // time they reappear (e.g. cooldown expires today, fires tomorrow if
    // a new loss creates another cooldown).
    for (const key of [...firedRef.current]) {
      if (!seen.has(key)) firedRef.current.delete(key);
    }
  }, [state, settings, toast, tradingAccount]);
}

/** Fire-and-forget POST to the server dispatcher. Errors are swallowed —
 *  delivery failures are surfaced in the dashboard's audit log instead of
 *  blocking the toast UX. */
function dispatchServerSide(payload: {
  ruleId: string;
  signature: string;
  title: string;
  detail?: string;
  channels: { discord?: boolean; ntfy?: boolean };
  botId?: string;
}): void {
  fetch("/api/alerts/dispatch", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    cache: "no-store",
  }).catch(() => {
    /* swallowed — see comment above */
  });
}

type Match = {
  signature: string;
  title: string;
  detail?: string;
  tone: "info" | "success" | "warn" | "error";
};

function evaluateRule(
  rule: AlertRule,
  state: NonNullable<ReturnType<typeof useStrategyState>["data"]>
): Match[] {
  switch (rule.type) {
    case "earnings-gate-T-N":
      return state.earningsT2Held
        .filter((e) => e.daysUntil <= rule.daysThreshold)
        .map((e) => ({
          signature: `earnings:${e.symbol}:${e.daysUntil}`,
          title: `${e.symbol} earnings T-${e.daysUntil}`,
          detail: `Held — bot force-exits before market-open the day before (rule #13).`,
          tone: e.daysUntil === 0 ? "error" : "warn",
        }));
    case "drawdown-breaker": {
      // Fire when EITHER breaker (day or week) is active. Signature includes
      // which breaker so the toast re-fires if a different breaker trips
      // later in the session.
      const out: Match[] = [];
      if (state.dayBreakerActive) {
        const pct = state.dayPnlPct?.toFixed(2) ?? "?";
        out.push({
          signature: "breaker:day",
          title: `Day breaker active (${pct}%)`,
          detail: `No new entries — day P&L below threshold (rule #14).`,
          tone: "error",
        });
      }
      if (state.weekBreakerActive) {
        const pct = state.weekPnlPct?.toFixed(2) ?? "?";
        out.push({
          signature: "breaker:week",
          title: `Week breaker active (${pct}%)`,
          detail: `Defensive mode — week P&L below threshold (rule #14).`,
          tone: "warn",
        });
      }
      return out;
    }
    case "sector-cap-reached":
      return state.sectorsAtCap.map((sector) => ({
        signature: `sector-cap:${sector}`,
        title: `Sector cap reached: ${sector}`,
        detail: `New entries in ${sector} are blocked (rule #17).`,
        tone: "warn",
      }));
    case "sector-blocked":
      return state.blockedSectors.map((sector) => ({
        signature: `sector-blocked:${sector}`,
        title: `Sector cooling off: ${sector}`,
        detail: `Two consecutive losses — sector blocked for 30 days (rule #10).`,
        tone: "warn",
      }));
    case "cooldown-expiring":
      return state.cooldownSymbols
        .filter((c) => c.daysRemaining <= rule.daysThreshold)
        .map((c) => ({
          signature: `cooldown:${c.symbol}:${c.daysRemaining}`,
          title: `${c.symbol} cooldown unlocks in ${c.daysRemaining}d`,
          detail: `Last stop: ${c.lastLossDate} (rule #20).`,
          tone: "info",
        }));
    case "rule-violation":
      // Fired by OrderEntryTile already (toast on rejection); listing here
      // for completeness so the rule can be enabled/disabled even though
      // the trigger lives in the order path, not the watcher.
      return [];
  }
}
