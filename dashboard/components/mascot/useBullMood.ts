"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import useSWR from "swr";
import { useAccountSummary } from "@/components/live/useAccountSummary";
import { useLiveSwr } from "@/lib/useLiveSwr";
import { alpacaApiUrl, type AlpacaMode } from "@/lib/alpacaMode";
import {
  type AlpacaPosition,
  type AlpacaErrorEnvelope,
} from "@/lib/types/alpaca";
import { useSettingsOptional } from "@/components/providers/SettingsProvider";
import { DEFAULTS } from "@/lib/settings.schema";
import { useStrategyState, type StrategyState } from "@/lib/useStrategyState";
import type { Mood } from "./BullCharacter";
import type { MoodContext } from "./useMoodContext";

type Position = Pick<AlpacaPosition, "symbol" | "unrealized_plpc">;

// Backstops if the SettingsProvider isn't mounted (e.g. SSR shell, tests).
// Live values come from `settings.strategy.*` via useSettingsOptional below.
const MAX_OPEN_POSITIONS = DEFAULTS.strategy.maxOpenPositions;
const TARGET_DEPLOYED_LOW = DEFAULTS.strategy.targetDeployedLowPct;
const TARGET_DEPLOYED_HIGH = DEFAULTS.strategy.targetDeployedHighPct;
const DAY_BREAKER = DEFAULTS.strategy.dayBreakerPct;
const WEEK_BREAKER = DEFAULTS.strategy.weekBreakerPct;

export type BullMoodSnapshot =
  | { loading: true }
  | { loading: false; error: string }
  | {
      loading: false;
      mood: Mood;
      bullPower: number;
      greenDays: number | null;
      riskHealth: number;
      marketMood: number | null;
      flavor: string;
      detail: {
        dayPct: number;
        dayPnl: number;
        equity: number;
        deployed: number;
        positionCount: number | null;
        winningPositionCount: number | null;
        spyPhasePct: number | null;
        phaseStart: string | null;
        startingEquity: number | null;
        winStreak: number | null;
        riskParts: { deployedScore: number; drawdownScore: number; slotsScore: number };
      };
    };

const FLAVOR: Record<Mood, string[]> = {
  bullish: [
    "Crushing it, boss!",
    "Bull market vibes.",
    "We are stalking the highs.",
    "Steady horns, steady hands.",
  ],
  bearish: [
    "Tough day. We bounce back tomorrow.",
    "Trust the stops. Live to trade again.",
    "Patience > revenge trades.",
    "Bear days build the discipline.",
  ],
  celebrating: [
    "🎉 Big green day! Take a victory lap.",
    "We're cooking. Keep the trail tight.",
    "This is the day they will write about.",
  ],
  neutral: [
    "Patience > activity. Stalking setups.",
    "Charts loaded. Coffee hot.",
    "Watching, waiting, ready.",
    "No drama is a strategy too.",
  ],
};

/** Strategy-state-aware flavor lines override the default deterministic pick.
 *  Returns null when nothing notable is happening — fall back to FLAVOR. */
function strategyFlavor(
  state: StrategyState | null,
  breakerActive: { day: boolean; week: boolean }
): string | null {
  if (!state) return null;
  if (breakerActive.day) {
    return "🛑 Day breaker tripped — no new entries until tomorrow.";
  }
  if (breakerActive.week) {
    return "⚠️ Week breaker tripped — defensive mode for the rest of the week.";
  }
  if (state.earningsT2Held.length > 0) {
    const e = state.earningsT2Held[0];
    return `📅 ${e.symbol} reports ${
      e.daysUntil === 0 ? "today" : `in ${e.daysUntil}d`
    } — earnings gate ahead.`;
  }
  if (state.sectorsAtCap.length > 0) {
    return `🚧 ${state.sectorsAtCap[0]} sector at cap — no new entries there.`;
  }
  if (state.blockedSectors.length > 0) {
    return `❄️ ${state.blockedSectors[0]} sector cooling off (rule #10).`;
  }
  if (state.cooldownSymbols.length > 0) {
    const c = state.cooldownSymbols[0];
    return `⏳ ${c.symbol} re-entry unlocks in ${c.daysRemaining}d.`;
  }
  if (state.blockedIdeas.length > 0) {
    const i = state.blockedIdeas[0];
    return `🔍 ${i.symbol}: ${i.detail}`;
  }
  return null;
}

function pickFlavor(mood: Mood, dateKey: string): string {
  const list = FLAVOR[mood];
  // deterministic per (mood, day) so flavor doesn't churn on every poll
  let hash = 0;
  const k = `${mood}:${dateKey}`;
  for (let i = 0; i < k.length; i++) hash = (hash * 31 + k.charCodeAt(i)) | 0;
  return list[Math.abs(hash) % list.length];
}

type FlavorDetail = {
  dayPct: number;
  positionCount: number | null;
  winningPositionCount: number | null;
  deployed: number;
  winStreak: number | null;
};

/** Data-aware flavor that interpolates the snapshot's actual numbers when
 *  they're notable. Returns null when nothing stands out so the static
 *  FLAVOR pool can pick a generic line. Replaces only the FLAVOR fallback —
 *  strategyFlavor's situational warnings (breakers, earnings, cooldowns)
 *  still take precedence. Audit T-dialogue. */
function enrichedFlavor(mood: Mood, d: FlavorDetail): string | null {
  const fmt1 = (n: number) => n.toFixed(1);
  const absPct = (n: number) => fmt1(Math.abs(n));
  const wins = d.winningPositionCount ?? 0;
  const positions = d.positionCount ?? 0;
  const streak = d.winStreak ?? 0;

  switch (mood) {
    case "celebrating":
      if (d.dayPct >= 5) return `🎉 +${fmt1(d.dayPct)}% day — top of the leaderboard.`;
      if (streak >= 3) return `🎉 ${streak} green days running — momentum's real.`;
      if (d.dayPct >= 3) return `🎉 +${fmt1(d.dayPct)}% — keep the trail tight, let it ride.`;
      return null;
    case "bullish":
      if (wins >= 3 && positions >= 3) {
        return `Running ${wins} of ${positions} green — discipline pays.`;
      }
      if (d.dayPct >= 1.5) return `📈 +${fmt1(d.dayPct)}% — letting winners run.`;
      if (streak >= 2) return `📈 Day ${streak + 1} of green — stay the course.`;
      return null;
    case "bearish":
      if (d.dayPct <= -2) return `🛑 -${absPct(d.dayPct)}% — breaker up, no new entries.`;
      if (d.dayPct <= -1) return `Off ${absPct(d.dayPct)}% — patience, stops do the work.`;
      if (positions === 0) return `Cash heavy on a red day — that's a feature, not a bug.`;
      return null;
    case "neutral":
      if (positions === 0) return `No positions — stalking setups, no FOMO.`;
      if (positions >= 4) {
        return `${positions} positions, ${fmt1(d.deployed)}% deployed — full slate.`;
      }
      if (d.deployed < 50 && positions <= 2) {
        return `${fmt1(d.deployed)}% deployed — saving dry powder for conviction.`;
      }
      return null;
  }
  return null;
}

const fetcher = (u: string) => fetch(u).then((r) => r.json());

export function useBullMood(opts: {
  mode?: AlpacaMode;
  accountId?: string | null;
  ctxOverride?: Pick<MoodContext, "winStreak" | "spyPhasePct" | "phaseStart" | "startingEquity"> | null;
  fallbackCtx?: MoodContext | null;
  todayKey: string;
}): BullMoodSnapshot {
  const summary = useAccountSummary({ mode: opts.mode, accountId: opts.accountId });
  const settingsCtx = useSettingsOptional();
  const strategy = settingsCtx?.settings.strategy ?? DEFAULTS.strategy;
  const { data: strategyState } = useStrategyState();
  const liveOpts = useLiveSwr(5000);
  const positionsKey =
    summary.loading || "error" in summary
      ? null
      : alpacaApiUrl(
          "positions",
          opts.accountId ? { accountId: opts.accountId } : { mode: summary.mode }
        );
  const { data: positionsData } = useSWR<Position[] | AlpacaErrorEnvelope>(
    positionsKey,
    fetcher,
    { ...liveOpts, keepPreviousData: true }
  );

  const ctx = opts.ctxOverride ?? opts.fallbackCtx ?? null;
  // ctxOverride is a narrow Pick<> that doesn't include weekStartPortfolio,
  // so the field only flows through when ctx came from the SWR-backed
  // fallback (useMoodContext). Cast to safely read the optional. When absent
  // the week breaker simply stays inactive — same behavior as before this fix.
  const weekStart =
    (ctx as { weekStartPortfolio?: number | null } | null)?.weekStartPortfolio ?? null;

  // ─── Hysteresis: only flip mood if condition holds 2 polls in a row.
  const [committedMood, setCommittedMood] = useState<Mood>("neutral");
  const candidateRef = useRef<{ mood: Mood; consecutive: number }>({
    mood: "neutral",
    consecutive: 0,
  });

  const breakerActive = useMemo(() => {
    if (summary.loading || "error" in summary) {
      return { day: false, week: false };
    }
    const weekPct =
      weekStart != null && weekStart > 0
        ? ((summary.equity - weekStart) / weekStart) * 100
        : null;
    return {
      day: summary.dayPct <= strategy.dayBreakerPct,
      week: weekPct != null && weekPct <= strategy.weekBreakerPct,
    };
  }, [summary, strategy, weekStart]);

  const candidate: Mood = useMemo(() => {
    if (summary.loading || "error" in summary) return committedMood;
    // Strategy overrides: drawdown breaker forces bearish regardless of day P&L
    // (the user is locked out of new entries — emotional read should match).
    if (breakerActive.day || breakerActive.week) return "bearish";
    const p = summary.dayPct;
    if (p >= strategy.celebrateThresholdPct) return "celebrating";
    if (p >= strategy.bullishThresholdPct) return "bullish";
    if (p <= strategy.bearishThresholdPct) return "bearish";
    return "neutral";
  }, [summary, committedMood, strategy, breakerActive]);

  useEffect(() => {
    if (candidate === committedMood) {
      candidateRef.current = { mood: candidate, consecutive: 0 };
      return;
    }
    if (candidateRef.current.mood === candidate) {
      candidateRef.current.consecutive += 1;
    } else {
      candidateRef.current = { mood: candidate, consecutive: 1 };
    }
    if (candidateRef.current.consecutive >= 2) {
      setCommittedMood(candidate);
    }
  }, [candidate, committedMood]);

  if (summary.loading) return { loading: true };
  if ("error" in summary) return { loading: false, error: summary.error };

  const positions: Position[] | null = Array.isArray(positionsData) ? positionsData : null;
  const positionCount = positions?.length ?? null;
  const winningPositionCount =
    positions != null
      ? positions.filter((p) => Number(p.unrealized_plpc ?? 0) > 0).length
      : null;

  const bullPower = clamp(((summary.dayPct + 2) / 4) * 100, 0, 100);

  const deployedScore = scoreDeployedBand(summary.deployed);
  const drawdownScore = scoreDrawdown(summary.dayPct);
  const slotsScore = scoreSlots(positionCount);
  const riskHealth = Math.round((deployedScore + drawdownScore + slotsScore) / 3);

  const marketMood =
    ctx?.spyPhasePct == null
      ? null
      : clamp(((ctx.spyPhasePct + 5) / 10) * 100, 0, 100);

  const greenDays = ctx?.winStreak ?? null;
  const stratFlavor = strategyFlavor(strategyState, breakerActive);
  const enriched =
    stratFlavor ??
    enrichedFlavor(committedMood, {
      dayPct: summary.dayPct,
      positionCount,
      winningPositionCount,
      deployed: summary.deployed,
      winStreak: greenDays,
    });
  const flavor = enriched ?? pickFlavor(committedMood, opts.todayKey);

  return {
    loading: false,
    mood: committedMood,
    bullPower: Math.round(bullPower),
    greenDays,
    riskHealth,
    marketMood: marketMood == null ? null : Math.round(marketMood),
    flavor,
    detail: {
      dayPct: summary.dayPct,
      dayPnl: summary.dayPnl,
      equity: summary.equity,
      deployed: summary.deployed,
      positionCount,
      winningPositionCount,
      spyPhasePct: ctx?.spyPhasePct ?? null,
      phaseStart: ctx?.phaseStart ?? null,
      startingEquity: ctx?.startingEquity ?? null,
      winStreak: greenDays,
      riskParts: { deployedScore, drawdownScore, slotsScore },
    },
  };
}

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

function scoreDeployedBand(deployed: number): number {
  // Full credit inside 75-85, linear decay outside.
  if (deployed >= TARGET_DEPLOYED_LOW && deployed <= TARGET_DEPLOYED_HIGH) return 100;
  if (deployed < TARGET_DEPLOYED_LOW) {
    return clamp(100 - (TARGET_DEPLOYED_LOW - deployed) * 4, 0, 100);
  }
  return clamp(100 - (deployed - TARGET_DEPLOYED_HIGH) * 4, 0, 100);
}

function scoreDrawdown(dayPct: number): number {
  // 100 at flat, 0 at the breaker (-2%), beyond = 0.
  if (dayPct >= 0) return 100;
  if (dayPct <= DAY_BREAKER) return 0;
  return clamp(100 + (dayPct / DAY_BREAKER) * -100, 0, 100);
}

function scoreSlots(count: number | null): number {
  if (count == null) return 50;
  // Sweet spot 4-5 of 6 cap; penalize 0 (idle) and 6 (over-saturated).
  const headroom = MAX_OPEN_POSITIONS - count;
  if (count === 0) return 35;
  if (headroom <= 0) return 50;
  if (headroom === 1 || headroom === 2) return 100;
  return clamp(60 + headroom * 8, 0, 100);
}

export { DAY_BREAKER, WEEK_BREAKER, MAX_OPEN_POSITIONS };
