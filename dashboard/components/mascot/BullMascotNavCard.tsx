"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import clsx from "clsx";
import { fmtPct } from "@/lib/format";
import { todayInCT } from "@/lib/time";
import { useTradingAccountOptional } from "@/lib/tradingAccountContext";
import { useSettingsOptional } from "@/components/providers/SettingsProvider";
import { BullCharacter } from "./BullCharacter";
import { Confetti } from "./Confetti";
import { BullMascotModal } from "./BullMascotModal";
import { useBullMood } from "./useBullMood";
import { useMoodContext } from "./useMoodContext";
import { levelFor } from "@/lib/mascot/level";
import { seasonalOutfitFor } from "@/lib/mascot/seasonal";
import { useIdleGesture } from "./useIdleGesture";
import { useAchievementWatcher } from "./useAchievementWatcher";

export function BullMascotNavCard({ className }: { className?: string }) {
  const settings = useSettingsOptional();
  const account = useTradingAccountOptional();
  const moodCtx = useMoodContext();
  const [open, setOpen] = useState(false);
  const [todayKey, setTodayKey] = useState("init");
  const [mounted, setMounted] = useState(false);
  const [confettiActive, setConfettiActive] = useState(false);

  useEffect(() => {
    setMounted(true);
    setTodayKey(todayInCT());
  }, []);

  const snapshot = useBullMood({
    mode: account?.account,
    accountId: account?.accountId,
    ctxOverride: null,
    fallbackCtx: moodCtx.data,
    todayKey,
  });

  const showInNav = settings?.settings.mascot.showInNav ?? true;
  const mascotName = settings?.settings.mascot.name ?? "Trader Max";
  const confettiOnWin = settings?.settings.mascot.confettiOnWin ?? true;
  const seasonalEnabled = settings?.settings.mascot.seasonalOutfits ?? true;
  const idleEnabled = settings?.settings.mascot.idleAnimations ?? true;
  const seasonal =
    seasonalEnabled && todayKey !== "init" ? seasonalOutfitFor(todayKey) : null;
  const idleGesture = useIdleGesture(idleEnabled);

  const phasePctForLevel =
    !snapshot.loading &&
    !("error" in snapshot) &&
    moodCtx.data?.startingEquity != null &&
    moodCtx.data.startingEquity > 0
      ? ((snapshot.detail.equity - moodCtx.data.startingEquity) /
          moodCtx.data.startingEquity) *
        100
      : null;
  const level = levelFor(phasePctForLevel);

  // Always-on achievement watcher: this card is mounted on every route.
  useAchievementWatcher({
    dayPct: !snapshot.loading && !("error" in snapshot) ? snapshot.detail.dayPct : null,
    winStreak: !snapshot.loading && !("error" in snapshot) ? snapshot.detail.winStreak : null,
    phasePct: phasePctForLevel,
    spyPhasePct: moodCtx.data?.spyPhasePct ?? null,
    level: level?.current.level ?? null,
    settings: settings?.settings ?? null,
  });

  const isCelebrating =
    !snapshot.loading && !("error" in snapshot) && snapshot.mood === "celebrating";

  useEffect(() => {
    if (!confettiOnWin || !isCelebrating || todayKey === "init") return;
    const key = `mascot:confetti:${todayKey}`;
    try {
      if (localStorage.getItem(key)) return;
      localStorage.setItem(key, "1");
    } catch {
      return;
    }
    setConfettiActive(true);
  }, [isCelebrating, confettiOnWin, todayKey]);

  if (!mounted || !showInNav) {
    // Preserve layout: keep the parent's `mt-auto` so the footer still
    // pushes to the bottom of the sidebar when the mascot is hidden.
    return <div className={className} aria-hidden="true" />;
  }

  const mood =
    !snapshot.loading && !("error" in snapshot) ? snapshot.mood : "neutral";
  const dayPct =
    !snapshot.loading && !("error" in snapshot) ? snapshot.detail.dayPct : null;

  return (
    <div className={clsx("relative", className)}>
      <Confetti active={confettiActive} onDone={() => setConfettiActive(false)} />
      <button
        type="button"
        onClick={() => setOpen(true)}
        title={`${mascotName} — open performance recap`}
        aria-label={`Open ${mascotName} performance recap`}
        className="w-full frost glass-interactive rounded-2xl p-2.5 flex items-center gap-2.5 text-left"
      >
        <div className="shrink-0">
          <BullCharacter
            mood={mood}
            size="sm"
            seasonal={seasonal}
            idleGesture={idleGesture}
          />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[9px] uppercase tracking-[0.16em] text-[var(--color-muted)] font-semibold truncate">
            {mascotName}
          </div>
          <div
            className={clsx(
              "text-xs font-semibold tabular leading-tight",
              dayPct == null
                ? "text-[var(--color-muted)]"
                : dayPct > 0
                ? "text-[var(--color-up)]"
                : dayPct < 0
                ? "text-[var(--color-down)]"
                : "text-[var(--color-text)]"
            )}
          >
            {dayPct == null ? "—" : fmtPct(dayPct)}
          </div>
          {level && (
            <div className="mt-1.5">
              <div className="flex items-baseline justify-between text-[9px] tabular text-[var(--color-muted)]">
                <span>
                  Lvl {level.current.level} · {level.current.title}
                </span>
                {level.next && <span>{Math.round(level.progressPct)}%</span>}
              </div>
              <div className="mt-0.5 h-1 rounded-full overflow-hidden bg-[rgba(255,255,255,0.08)]">
                <motion.div
                  className="h-full rounded-full bg-[var(--color-accent)]"
                  initial={false}
                  animate={{ width: `${level.next ? level.progressPct : 100}%` }}
                  transition={{ type: "spring", stiffness: 180, damping: 24 }}
                />
              </div>
            </div>
          )}
        </div>
      </button>

      <BullMascotModal
        open={open}
        onClose={() => setOpen(false)}
        mascotName={mascotName}
        snapshot={snapshot}
        ctx={moodCtx.data}
        level={level}
        seasonal={seasonal}
      />
    </div>
  );
}
