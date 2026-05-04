/**
 * Trader Max achievements — static catalog + localStorage-backed earnings.
 *
 * Why localStorage (not server-side memory file): Phase 2 is a single-device
 * gamification layer; nothing here should affect the bot or be shared across
 * machines. Per-device tracking sidesteps the idempotency requirements that
 * apply to memory writes (see CLAUDE.md "Memory write idempotency").
 */

import { todayInCT } from "@/lib/time";

export type AchievementId =
  | "first-green-day"
  | "5pct-day"
  | "5-day-streak"
  | "10-day-streak"
  | "alpha-5"
  | "breaker-survivor"
  | "level-5"
  | "level-legend"
  | "first-motivation";

export type AchievementCtx = {
  dayPct: number | null;
  winStreak: number | null;
  phasePct: number | null;
  spyPhasePct: number | null;
  level: number | null;
  motivationsCount: number;
  /** Did we previously observe a same-CT-day dayPct ≤ -2% that's now back to ≥ 0? */
  recoveredFromBreaker: boolean;
};

export type Achievement = {
  id: AchievementId;
  label: string;
  description: string;
  icon: string;
  predicate: (ctx: AchievementCtx) => boolean;
};

export const ACHIEVEMENTS: Achievement[] = [
  {
    id: "first-green-day",
    label: "First green",
    description: "Closed a session up at least 0.1%.",
    icon: "🌱",
    predicate: (c) => (c.dayPct ?? -1) >= 0.1,
  },
  {
    id: "5pct-day",
    label: "Five-bagger day",
    description: "Crossed +5% in a single session.",
    icon: "🚀",
    predicate: (c) => (c.dayPct ?? -1) >= 5,
  },
  {
    id: "5-day-streak",
    label: "Five-day streak",
    description: "Five consecutive winning days.",
    icon: "🔥",
    predicate: (c) => (c.winStreak ?? 0) >= 5,
  },
  {
    id: "10-day-streak",
    label: "Ten-day streak",
    description: "Ten consecutive winning days.",
    icon: "🌟",
    predicate: (c) => (c.winStreak ?? 0) >= 10,
  },
  {
    id: "alpha-5",
    label: "Five-point alpha",
    description: "Beat SPY by 5+ points over the phase.",
    icon: "🎯",
    predicate: (c) =>
      c.phasePct != null && c.spyPhasePct != null && c.phasePct - c.spyPhasePct >= 5,
  },
  {
    id: "breaker-survivor",
    label: "Breaker survivor",
    description: "Bounced back to flat after dipping past the -2% breaker.",
    icon: "🛡️",
    predicate: (c) => c.recoveredFromBreaker && (c.dayPct ?? -10) >= 0,
  },
  {
    id: "level-5",
    label: "Operator (Lvl 5)",
    description: "Reached level 5 — the operator tier.",
    icon: "⚙️",
    predicate: (c) => (c.level ?? 0) >= 5,
  },
  {
    id: "level-legend",
    label: "Legend (Lvl 10)",
    description: "Hit the legendary tier — phase return ≥ 50%.",
    icon: "👑",
    predicate: (c) => (c.level ?? 0) >= 10,
  },
  {
    id: "first-motivation",
    label: "Pep talker",
    description: "Cheered Trader Max at least once.",
    icon: "📣",
    predicate: (c) => c.motivationsCount > 0,
  },
];

const STORAGE_KEY = "mascot:achievements";
const BREAKER_KEY_PREFIX = "mascot:breaker-seen:";

type EarnedRecord = Partial<Record<AchievementId, string>>; // id → CT date earned

export function loadEarned(): EarnedRecord {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return typeof parsed === "object" && parsed != null ? (parsed as EarnedRecord) : {};
  } catch {
    return {};
  }
}

function saveEarned(rec: EarnedRecord) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(rec));
  } catch {
    // ignore
  }
}

/** Returns achievement IDs newly earned this evaluation. Mutates persisted state. */
export function evaluateAchievements(ctx: AchievementCtx): AchievementId[] {
  const earned = loadEarned();
  const today = todayInCT();
  const newlyEarned: AchievementId[] = [];
  for (const a of ACHIEVEMENTS) {
    if (earned[a.id]) continue;
    if (a.predicate(ctx)) {
      earned[a.id] = today;
      newlyEarned.push(a.id);
    }
  }
  if (newlyEarned.length > 0) saveEarned(earned);
  return newlyEarned;
}

export function clearEarned() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

/**
 * Tracks whether the day's P&L breached the -2% breaker so we can detect
 * a recovery later in the same CT day.
 */
export function observeBreakerState(dayPct: number | null): boolean {
  if (typeof window === "undefined" || dayPct == null) return false;
  const today = todayInCT();
  const key = `${BREAKER_KEY_PREFIX}${today}`;
  try {
    const seen = window.localStorage.getItem(key) === "1";
    if (!seen && dayPct <= -2) {
      window.localStorage.setItem(key, "1");
      return false;
    }
    return seen;
  } catch {
    return false;
  }
}
