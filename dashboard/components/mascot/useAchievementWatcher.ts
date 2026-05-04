"use client";

import { useEffect, useRef } from "react";
import {
  evaluateAchievements,
  observeBreakerState,
  type AchievementCtx,
} from "@/lib/mascot/achievements";
import { emitAchievementToast } from "./AchievementToast";
import { playCue, shouldPlayCue } from "@/lib/mascot/sounds";
import type { DashboardSettings } from "@/lib/settings.schema";

type WatcherSettings = {
  mascot: Pick<DashboardSettings["mascot"], "soundsEnabled">;
  notifications: Pick<DashboardSettings["notifications"], "quietHours">;
};

export function readMotivationsCount(): number {
  if (typeof window === "undefined") return 0;
  try {
    const raw = window.localStorage.getItem("mascot:motivations");
    if (!raw) return 0;
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.length : 0;
  } catch {
    return 0;
  }
}

/**
 * Evaluates achievements whenever the relevant inputs change. New unlocks
 * emit a toast + (optional) sound cue. Idempotent — already-earned achievements
 * are skipped by `evaluateAchievements`.
 */
export function useAchievementWatcher(input: {
  dayPct: number | null;
  winStreak: number | null;
  phasePct: number | null;
  spyPhasePct: number | null;
  level: number | null;
  settings: WatcherSettings | null | undefined;
}) {
  // Stable input snapshot to suppress duplicate evals on identical re-renders.
  const lastKey = useRef<string>("");

  useEffect(() => {
    const recoveredFromBreaker = observeBreakerState(input.dayPct);
    const motivationsCount = readMotivationsCount();
    const ctx: AchievementCtx = {
      dayPct: input.dayPct,
      winStreak: input.winStreak,
      phasePct: input.phasePct,
      spyPhasePct: input.spyPhasePct,
      level: input.level,
      motivationsCount,
      recoveredFromBreaker,
    };
    const key = JSON.stringify(ctx);
    if (key === lastKey.current) return;
    lastKey.current = key;

    const newly = evaluateAchievements(ctx);
    if (newly.length === 0) return;
    for (const id of newly) emitAchievementToast(id);

    // Sound: one ding per batch (don't stack).
    if (
      input.settings?.mascot.soundsEnabled &&
      shouldPlayCue(input.settings)
    ) {
      playCue("ding");
    }
  }, [
    input.dayPct,
    input.winStreak,
    input.phasePct,
    input.spyPhasePct,
    input.level,
    input.settings,
  ]);
}
