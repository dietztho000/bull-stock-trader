/**
 * Trader Max leveling — keyed off cumulative phase return %.
 * Lvl 1 (rookie) at +0%; Lvl 10 (legend) at +50%. Linear bands tuned to
 * the bull-stock-trader challenge cadence (single-digit weekly moves, ~50%
 * phase target as the "stretch" bull-case).
 */

export type Level = {
  level: number;
  title: string;
  /** Phase % at the START of this level (inclusive). */
  startsAt: number;
  /** Phase % at the START of the next level (exclusive). null at top level. */
  nextAt: number | null;
};

export const LEVELS: Level[] = [
  { level: 1, title: "Rookie", startsAt: -Infinity, nextAt: 2 },
  { level: 2, title: "Scout", startsAt: 2, nextAt: 5 },
  { level: 3, title: "Trader", startsAt: 5, nextAt: 8 },
  { level: 4, title: "Sharp", startsAt: 8, nextAt: 12 },
  { level: 5, title: "Operator", startsAt: 12, nextAt: 17 },
  { level: 6, title: "Veteran", startsAt: 17, nextAt: 22 },
  { level: 7, title: "Closer", startsAt: 22, nextAt: 28 },
  { level: 8, title: "Hunter", startsAt: 28, nextAt: 35 },
  { level: 9, title: "Apex", startsAt: 35, nextAt: 50 },
  { level: 10, title: "Legend", startsAt: 50, nextAt: null },
];

export type LevelProgress = {
  current: Level;
  next: Level | null;
  /** 0–100 progress within the current band. 100 when at top level. */
  progressPct: number;
};

export function levelFor(phasePct: number | null): LevelProgress | null {
  if (phasePct == null || !Number.isFinite(phasePct)) return null;
  const current =
    [...LEVELS]
      .reverse()
      .find((l) => phasePct >= l.startsAt) ?? LEVELS[0];
  const idx = LEVELS.indexOf(current);
  const next = idx < LEVELS.length - 1 ? LEVELS[idx + 1] : null;
  if (!next || current.nextAt == null) {
    return { current, next: null, progressPct: 100 };
  }
  const span = current.nextAt - current.startsAt;
  const traveled = phasePct - current.startsAt;
  const progressPct = span > 0 ? Math.max(0, Math.min(100, (traveled / span) * 100)) : 0;
  return { current, next, progressPct };
}

const PEAK_KEY = "mascot:peak-level";

export function readPeakLevel(): number | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(PEAK_KEY);
    if (raw == null) return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

export function recordPeakLevel(level: number): number {
  if (typeof window === "undefined") return level;
  try {
    const prev = readPeakLevel();
    const next = prev == null ? level : Math.max(prev, level);
    if (next !== prev) {
      window.localStorage.setItem(PEAK_KEY, String(next));
    }
    return next;
  } catch {
    return level;
  }
}
