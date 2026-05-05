/** Pure mood-selection logic extracted from useBullMood so it can be tested
 *  without React Testing Library / SWR mocks. The hook composes these
 *  functions; tests cover hysteresis, breaker detection, candidate
 *  selection, and the three layers of flavor (strategy → enriched → static).
 */

import type { Mood } from "@/components/mascot/BullCharacter";

export type StrategyThresholds = {
  celebrateThresholdPct: number;
  bullishThresholdPct: number;
  bearishThresholdPct: number;
  dayBreakerPct: number;
  weekBreakerPct: number;
};

export type StrategyStateLike = {
  earningsT2Held: Array<{ symbol: string; daysUntil: number }>;
  sectorsAtCap: string[];
  blockedSectors: string[];
  cooldownSymbols: Array<{ symbol: string; daysRemaining: number }>;
  blockedIdeas: Array<{ symbol: string; detail: string }>;
};

export type AccountSummaryLike = {
  dayPct: number;
  equity: number;
};

export type FlavorDetail = {
  dayPct: number;
  positionCount: number | null;
  winningPositionCount: number | null;
  deployed: number;
  winStreak: number | null;
};

export const FLAVOR: Record<Mood, string[]> = {
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

/** Compute day + week breaker active flags. Day breaker uses summary.dayPct
 *  vs the strategy threshold (negative-ish, e.g. -2). Week breaker requires
 *  weekStartPortfolio to derive weekPct; null weekStart leaves it inactive
 *  (same fail-safe as before audit T-week). */
export function computeBreakers(
  summary: AccountSummaryLike,
  strategy: StrategyThresholds,
  weekStart: number | null
): { day: boolean; week: boolean } {
  const weekPct =
    weekStart != null && weekStart > 0
      ? ((summary.equity - weekStart) / weekStart) * 100
      : null;
  return {
    day: summary.dayPct <= strategy.dayBreakerPct,
    week: weekPct != null && weekPct <= strategy.weekBreakerPct,
  };
}

/** Pick the candidate mood for the current poll. Day P&L drives most of it;
 *  active breakers force bearish regardless. Caller is responsible for
 *  hysteresis (committing only after the same candidate holds N polls). */
export function candidateMood(
  summary: AccountSummaryLike,
  strategy: StrategyThresholds,
  breakerActive: { day: boolean; week: boolean }
): Mood {
  if (breakerActive.day || breakerActive.week) return "bearish";
  const p = summary.dayPct;
  if (p >= strategy.celebrateThresholdPct) return "celebrating";
  if (p >= strategy.bullishThresholdPct) return "bullish";
  if (p <= strategy.bearishThresholdPct) return "bearish";
  return "neutral";
}

/** Strategy-state-aware flavor lines override the default deterministic pick.
 *  Returns null when nothing notable is happening — fall back to enriched
 *  or FLAVOR. */
export function strategyFlavor(
  state: StrategyStateLike | null,
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

/** Deterministic per (mood, day) pick from the static FLAVOR pool. */
export function pickFlavor(mood: Mood, dateKey: string): string {
  const list = FLAVOR[mood];
  let hash = 0;
  const k = `${mood}:${dateKey}`;
  for (let i = 0; i < k.length; i++) hash = (hash * 31 + k.charCodeAt(i)) | 0;
  return list[Math.abs(hash) % list.length];
}

/** Data-aware flavor that interpolates snapshot numbers when notable.
 *  Returns null when nothing stands out so the FLAVOR pool can pick a
 *  generic line. Audit T-dialogue. */
export function enrichedFlavor(mood: Mood, d: FlavorDetail): string | null {
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

/** Layered flavor picker: strategy state first, then data-aware enriched,
 *  then static deterministic fallback. Mirrors the cascade in useBullMood. */
export function pickMoodFlavor(
  mood: Mood,
  detail: FlavorDetail,
  state: StrategyStateLike | null,
  breakerActive: { day: boolean; week: boolean },
  dateKey: string
): string {
  return (
    strategyFlavor(state, breakerActive) ??
    enrichedFlavor(mood, detail) ??
    pickFlavor(mood, dateKey)
  );
}

/** Pure hysteresis state machine. The hook keeps a ref of (candidate,
 *  consecutive count) and bumps committed mood only after the same
 *  candidate holds for `requiredConsecutive` polls. Pulled out so we can
 *  test the transition rules without React. */
export type HysteresisState = { mood: Mood; consecutive: number };

export function advanceHysteresis(
  candidate: Mood,
  committed: Mood,
  prev: HysteresisState,
  requiredConsecutive: number
): { committed: Mood; ref: HysteresisState } {
  if (candidate === committed) {
    return { committed, ref: { mood: candidate, consecutive: 0 } };
  }
  const consecutive =
    prev.mood === candidate ? prev.consecutive + 1 : 1;
  if (consecutive >= requiredConsecutive) {
    return { committed: candidate, ref: { mood: candidate, consecutive } };
  }
  return { committed, ref: { mood: candidate, consecutive } };
}
