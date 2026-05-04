"use client";

import { useEffect, useRef } from "react";
import { useStrategyState } from "./useStrategyState";
import { useSettingsOptional } from "@/components/providers/SettingsProvider";
import { useToastOptional } from "@/components/providers/ToastProvider";
import type { AlertRule } from "./settings.schema";

/** Mounted once globally — watches strategy state vs the user's alert rules
 *  and pushes toasts when conditions are newly met. Tracks fired alerts in a
 *  Set keyed by `${ruleId}:${signature}` to avoid spamming on every poll. */
export function useAlertWatcher() {
  const { data: state } = useStrategyState();
  const settings = useSettingsOptional();
  const toast = useToastOptional();
  const firedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!state || !settings || !toast) return;
    const cfg = settings.settings.alerts;
    if (!cfg.enabled) return;

    const seen = new Set<string>();

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
        // Discord/ntfy delivery is intentionally not wired here — server-side
        // dispatcher is a follow-up.
      }
    }

    // Garbage-collect signatures that no longer match so they re-fire next
    // time they reappear (e.g. cooldown expires today, fires tomorrow if
    // a new loss creates another cooldown).
    for (const key of [...firedRef.current]) {
      if (!seen.has(key)) firedRef.current.delete(key);
    }
  }, [state, settings, toast]);
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
    case "drawdown-breaker":
      // The strategy state currently doesn't expose breaker booleans
      // directly; the brief route computes them. Skip for now — leave a
      // signature for the dispatcher refactor.
      return [];
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
