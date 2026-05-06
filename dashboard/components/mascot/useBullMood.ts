"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import useSWR from "swr";
import { useAccountSummary } from "@/components/live/useAccountSummary";
import { useLiveSwr } from "@/lib/useLiveSwr";
import { alpacaApiUrl, type AlpacaScope } from "@/lib/alpacaMode";
import {
  type AlpacaPosition,
  type AlpacaErrorEnvelope,
} from "@/lib/types/alpaca";
import { useSettingsOptional } from "@/components/providers/SettingsProvider";
import { DEFAULTS } from "@/lib/settings.schema";
import { useStrategyState } from "@/lib/useStrategyState";
import {
  candidateMood as pickCandidateMood,
  computeBreakers,
  pickMoodFlavor,
} from "@/lib/mascot/moodLogic";
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

const fetcher = (u: string) => fetch(u).then((r) => r.json());

export function useBullMood(opts: {
  scope?: AlpacaScope;
  ctxOverride?: Pick<MoodContext, "winStreak" | "spyPhasePct" | "phaseStart" | "startingEquity"> | null;
  fallbackCtx?: MoodContext | null;
  todayKey: string;
}): BullMoodSnapshot {
  const summary = useAccountSummary(opts.scope);
  const settingsCtx = useSettingsOptional();
  const strategy = settingsCtx?.settings.strategy ?? DEFAULTS.strategy;
  const { data: strategyState } = useStrategyState();
  const liveOpts = useLiveSwr(5000);
  const positionsAccountId =
    opts.scope?.kind === "account" ? opts.scope.accountId : null;
  const positionsKey =
    summary.loading || "error" in summary
      ? null
      : alpacaApiUrl(
          "positions",
          positionsAccountId
            ? { accountId: positionsAccountId }
            : { mode: summary.mode }
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
    return computeBreakers(summary, strategy, weekStart);
  }, [summary, strategy, weekStart]);

  const candidate: Mood = useMemo(() => {
    if (summary.loading || "error" in summary) return committedMood;
    return pickCandidateMood(summary, strategy, breakerActive);
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
  const flavor = pickMoodFlavor(
    committedMood,
    {
      dayPct: summary.dayPct,
      positionCount,
      winningPositionCount,
      deployed: summary.deployed,
      winStreak: greenDays,
    },
    strategyState ?? null,
    breakerActive,
    opts.todayKey
  );

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
