"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import clsx from "clsx";
import { fmtPct } from "@/lib/format";
import { todayInCT } from "@/lib/time";
import { useTradingAccountOptional } from "@/lib/tradingAccountContext";
import { accountScope } from "@/lib/alpacaMode";
import { useSettingsOptional } from "@/components/providers/SettingsProvider";
import { BullCharacter, type Mood } from "./BullCharacter";
import { Confetti } from "./Confetti";
import { BullMascotModal } from "./BullMascotModal";
import { useBullMood } from "./useBullMood";
import { useMoodContext } from "./useMoodContext";
import { levelFor } from "@/lib/mascot/level";
import { seasonalOutfitFor } from "@/lib/mascot/seasonal";
import { useIdleGesture } from "./useIdleGesture";
import { useAchievementWatcher } from "./useAchievementWatcher";
import { MascotErrorBoundary } from "./MascotErrorBoundary";
import { playCue, shouldPlayCue } from "@/lib/mascot/sounds";

export function BullMascotNavCard({ className }: { className?: string }) {
  return (
    <MascotErrorBoundary
      fallback={<div className={className} aria-hidden="true" />}
    >
      <BullMascotNavCardInner className={className} />
    </MascotErrorBoundary>
  );
}

function BullMascotNavCardInner({ className }: { className?: string }) {
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
    scope: accountScope(account?.account, account?.accountId),
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

  // Mood-transition sound cues. Fires only when the mood actually changes
  // (skips the initial commit) and respects soundsEnabled, quiet hours, and
  // prefers-reduced-motion. Audit T-sound. The nav card is the only place
  // that watches transitions — the dashboard tile uses the same hook so a
  // duplicate watcher there would double-fire on /.
  const reduced = useReducedMotion();
  const prevMoodRef = useRef<Mood | null>(null);
  useEffect(() => {
    if (snapshot.loading || "error" in snapshot) return;
    const current: Mood = snapshot.mood;
    const prev = prevMoodRef.current;
    prevMoodRef.current = current;
    if (prev == null || prev === current) return;
    if (!settings?.settings.mascot.soundsEnabled) return;
    if (!shouldPlayCue(settings.settings)) return;
    if (reduced) return;
    if (current === "celebrating" || current === "bullish") {
      playCue("moo");
    } else if (current === "bearish") {
      playCue("thunder");
    }
  }, [snapshot, settings, reduced]);

  const isCelebrating =
    !snapshot.loading && !("error" in snapshot) && snapshot.mood === "celebrating";

  useEffect(() => {
    if (!confettiOnWin || !isCelebrating || todayKey === "init") return;
    // Audit NU5 — per-location key so the nav card fires independently of
    // the BullMascotTile on /. Previously both raced the same key.
    const key = `mascot:confetti:nav:${todayKey}`;
    try {
      if (localStorage.getItem(key)) return;
      localStorage.setItem(key, "1");
    } catch {
      return;
    }
    setConfettiActive(true);
  }, [isCelebrating, confettiOnWin, todayKey]);

  if (!showInNav) {
    // Hidden by user setting — keep layout stable for the parent's mt-auto.
    return <div className={className} aria-hidden="true" />;
  }
  if (!mounted) {
    // Audit NU1 — show a 60×60 skeleton-shaped placeholder pre-hydration
    // so the sidebar doesn't reflow when the mascot mounts. Matches the
    // real card's overall footprint (avatar + 2-line text) so the layout
    // stays stable; aria-hidden because the real card replaces it.
    return (
      <div
        className={clsx("relative", className)}
        aria-hidden="true"
      >
        <div className="w-full frost rounded-2xl p-2.5 flex items-center gap-2.5">
          <div className="shrink-0 h-[60px] w-[60px] rounded-full bg-[rgba(255,255,255,0.04)] animate-pulse" />
          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="h-2 w-2/3 rounded bg-[rgba(255,255,255,0.04)] animate-pulse" />
            <div className="h-3 w-1/2 rounded bg-[rgba(255,255,255,0.04)] animate-pulse" />
          </div>
        </div>
      </div>
    );
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
