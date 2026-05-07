"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import clsx from "clsx";
import { Card } from "@/components/ui/Card";
import { HoverTooltip } from "@/components/ui/HoverTooltip";
import { fmtPct } from "@/lib/format";
import { todayInCT } from "@/lib/time";
import type { AlpacaScope } from "@/lib/alpacaMode";
import { useSettingsOptional } from "@/components/providers/SettingsProvider";
import { BullCharacter } from "./BullCharacter";
import { Confetti } from "./Confetti";
import { MoodMeter, MoodMetersGroup } from "./MoodMeters";
import { BullMascotModal } from "./BullMascotModal";
import { MultiBotMoodLine } from "./MultiBotMoodLine";
import { useBullMood } from "./useBullMood";
import type { MoodContext } from "./useMoodContext";
import { levelFor, recordPeakLevel } from "@/lib/mascot/level";
import { seasonalOutfitFor } from "@/lib/mascot/seasonal";
import { useIdleGesture, useTapToPet } from "./useIdleGesture";
import { useAchievementWatcher } from "./useAchievementWatcher";
import { MascotErrorBoundary } from "./MascotErrorBoundary";

export type BullMascotTileProps = {
  scope: AlpacaScope;
  ctxOverride: {
    winStreak: number | null;
    spyPhasePct: number | null;
    phaseStart: string | null;
    startingEquity: number | null;
    recentRows: Array<{ date: string; portfolio: number | null }>;
  };
};

export function BullMascotTile(props: BullMascotTileProps) {
  return (
    <MascotErrorBoundary
      fallback={
        <Card title="Trader Max">
          <div className="text-xs text-[var(--color-muted)]">
            Mascot temporarily unavailable.
          </div>
        </Card>
      }
    >
      <BullMascotTileInner {...props} />
    </MascotErrorBoundary>
  );
}

function BullMascotTileInner({ scope, ctxOverride }: BullMascotTileProps) {
  const settings = useSettingsOptional();
  const [open, setOpen] = useState(false);
  const [todayKey, setTodayKey] = useState("init");

  // Compute today key only on the client to avoid SSR/CSR drift.
  useEffect(() => {
    setTodayKey(todayInCT());
  }, []);

  const snapshot = useBullMood({
    scope,
    ctxOverride,
    fallbackCtx: null,
    todayKey,
  });

  const mascotName = settings?.settings.mascot.name ?? "Trader Max";
  const confettiOnWin = settings?.settings.mascot.confettiOnWin ?? true;
  const seasonalEnabled = settings?.settings.mascot.seasonalOutfits ?? true;
  const idleEnabled = settings?.settings.mascot.idleAnimations ?? true;
  const seasonal = seasonalEnabled && todayKey !== "init" ? seasonalOutfitFor(todayKey) : null;

  const phasePctForLevel =
    !snapshot.loading && !("error" in snapshot) && ctxOverride.startingEquity != null && ctxOverride.startingEquity > 0
      ? ((snapshot.detail.equity - ctxOverride.startingEquity) / ctxOverride.startingEquity) * 100
      : null;
  const level = useMemo(() => levelFor(phasePctForLevel), [phasePctForLevel]);

  // Persist peak level in localStorage (best-effort, ignore failures).
  useEffect(() => {
    if (level) recordPeakLevel(level.current.level);
  }, [level]);

  // Achievement watcher (emits toasts + optional sound on unlock).
  useAchievementWatcher({
    dayPct: !snapshot.loading && !("error" in snapshot) ? snapshot.detail.dayPct : null,
    winStreak: !snapshot.loading && !("error" in snapshot) ? snapshot.detail.winStreak : null,
    phasePct: phasePctForLevel,
    spyPhasePct: ctxOverride.spyPhasePct,
    level: level?.current.level ?? null,
    settings: settings?.settings ?? null,
  });

  const idleGesture = useIdleGesture(idleEnabled);
  const { petGesture, triggerPet } = useTapToPet();
  const activeGesture = petGesture ?? idleGesture;

  // Day-scoped one-shot confetti when celebrating.
  // Audit NU5 — keyed by location so the nav card and the dashboard tile
  // each fire once per day. Previously both raced for the same key and
  // whichever mounted first suppressed the other; this way both render
  // confetti in their own region.
  const [confettiActive, setConfettiActive] = useState(false);
  const isCelebrating = !snapshot.loading && !("error" in snapshot) && snapshot.mood === "celebrating";

  useEffect(() => {
    if (!confettiOnWin || !isCelebrating || todayKey === "init") return;
    const key = `mascot:confetti:tile:${todayKey}`;
    try {
      if (localStorage.getItem(key)) return;
      localStorage.setItem(key, "1");
    } catch {
      return;
    }
    setConfettiActive(true);
  }, [isCelebrating, confettiOnWin, todayKey]);

  const ctxForModal: MoodContext = useMemo(
    () => ({
      winStreak: ctxOverride.winStreak,
      spyPhasePct: ctxOverride.spyPhasePct,
      phaseStart: ctxOverride.phaseStart,
      startingEquity: ctxOverride.startingEquity,
      recentRows: ctxOverride.recentRows,
    }),
    [ctxOverride]
  );

  const moodLabel =
    snapshot.loading
      ? "Booting up…"
      : "error" in snapshot
      ? "Offline"
      : ({
          bullish: "Bullish",
          bearish: "Bearish",
          neutral: "Focused",
          celebrating: "Crushing it",
        } as const)[snapshot.mood];

  const tooltipContent =
    snapshot.loading || "error" in snapshot ? (
      <span className="font-semibold">{mascotName}</span>
    ) : (
      <div className="space-y-0.5">
        <div className="font-semibold text-[var(--color-text)]">
          {mascotName} <span className="text-[var(--color-muted)]">— {moodLabel}</span>
        </div>
        <div className="tabular text-[var(--color-muted)]">
          Day {fmtPct(snapshot.detail.dayPct)} · Risk {snapshot.riskHealth}/100
        </div>
      </div>
    );

  return (
    <Card
      title={mascotName}
      subtitle={moodLabel}
      right={
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="text-[10px] uppercase tracking-[0.14em] glass glass-interactive rounded-full px-2.5 py-1 font-semibold text-[var(--color-muted)] hover:text-[var(--color-text)] no-drag"
          aria-label="Open performance recap"
        >
          Recap →
        </button>
      }
    >
      <div className="relative">
        <Confetti active={confettiActive} onDone={() => setConfettiActive(false)} />
        <HoverTooltip content={tooltipContent}>
          <button
            type="button"
            onClick={() => setOpen(true)}
            onDoubleClick={triggerPet}
            aria-label={`${mascotName} — open performance recap`}
            className="no-drag w-full flex items-center justify-center py-1 cursor-pointer"
          >
            <motion.div
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.96 }}
              transition={{ type: "spring", stiffness: 380, damping: 28 }}
            >
              <BullCharacter
                mood={!snapshot.loading && !("error" in snapshot) ? snapshot.mood : "neutral"}
                size="md"
                seasonal={seasonal}
                idleGesture={activeGesture}
              />
            </motion.div>
          </button>
        </HoverTooltip>

        {!snapshot.loading && !("error" in snapshot) && (
          <div
            className={clsx(
              "mt-1 mb-3 text-center text-xs italic px-2",
              "text-[var(--color-muted)]"
            )}
          >
            “{snapshot.flavor}”
          </div>
        )}

        <MultiBotMoodLine />

        <MoodMetersGroup>
          {snapshot.loading ? (
            <SkeletonMeters />
          ) : "error" in snapshot ? (
            <div className="text-xs text-[var(--color-down)]">
              Live data offline: {snapshot.error}
            </div>
          ) : (
            <>
              <MoodMeter
                label="Bull Power"
                value={snapshot.bullPower}
                display={fmtPct(snapshot.detail.dayPct)}
                tone={
                  snapshot.detail.dayPct >= 0.3
                    ? "up"
                    : snapshot.detail.dayPct <= -1.5
                    ? "down"
                    : "accent"
                }
                hint="Day P&L vs ±2% breaker band"
              />
              <MoodMeter
                label="Green Days"
                value={
                  snapshot.greenDays == null
                    ? null
                    : Math.min(100, snapshot.greenDays * 20)
                }
                display={
                  snapshot.greenDays == null
                    ? "—"
                    : `${snapshot.greenDays} day${snapshot.greenDays === 1 ? "" : "s"}`
                }
                tone="up"
                hint="Consecutive winning sessions"
              />
              <MoodMeter
                label="Risk Health"
                value={snapshot.riskHealth}
                display={`${snapshot.riskHealth}/100`}
                tone={
                  snapshot.riskHealth >= 70
                    ? "up"
                    : snapshot.riskHealth >= 40
                    ? "warn"
                    : "down"
                }
                hint={`Deployed ${Math.round(snapshot.detail.deployed)}% · ${
                  snapshot.detail.positionCount ?? "—"
                }/6 slots`}
              />
              <MoodMeter
                label="Market Mood"
                value={snapshot.marketMood}
                display={
                  snapshot.detail.spyPhasePct == null
                    ? "—"
                    : fmtPct(snapshot.detail.spyPhasePct)
                }
                tone="accent"
                hint="SPY phase %"
              />
            </>
          )}
        </MoodMetersGroup>
      </div>

      <BullMascotModal
        open={open}
        onClose={() => setOpen(false)}
        mascotName={mascotName}
        snapshot={snapshot}
        ctx={ctxForModal}
        level={level}
        seasonal={seasonal}
      />
    </Card>
  );
}

function SkeletonMeters() {
  return (
    <div className="space-y-3">
      {[0, 1, 2, 3].map((i) => (
        <div key={i}>
          <div className="h-2 w-1/3 rounded bg-[rgba(255,255,255,0.06)] mb-1.5" />
          <div className="h-1.5 rounded-full bg-[rgba(255,255,255,0.05)] animate-pulse" />
        </div>
      ))}
    </div>
  );
}
