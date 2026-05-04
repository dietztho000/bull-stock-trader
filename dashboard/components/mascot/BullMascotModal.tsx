"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import clsx from "clsx";
import { fmtMoney, fmtPct, fmtSignedMoney, colorOf } from "@/lib/format";
import { todayInCT, fmtDateTimeCT } from "@/lib/time";
import { BullCharacter } from "./BullCharacter";
import { Confetti } from "./Confetti";
import {
  Career,
  LevelProgressBar,
  RiskBar,
  Sparkline,
  Stat,
} from "./BullMascotPieces";
import type { BullMoodSnapshot } from "./useBullMood";
import type { MoodContext } from "./useMoodContext";
import { ACHIEVEMENTS, loadEarned } from "@/lib/mascot/achievements";
import { type LevelProgress } from "@/lib/mascot/level";
import type { SeasonalOutfit } from "@/lib/mascot/seasonal";
import { useSettingsOptional } from "@/components/providers/SettingsProvider";
import { playCue, shouldPlayCue } from "@/lib/mascot/sounds";

const MOOD_HEADLINE: Record<string, string> = {
  bullish: "feeling bullish",
  bearish: "feeling tough",
  neutral: "stalking setups",
  celebrating: "on a tear",
};

type Motivation = { at: string; date: string };

export function BullMascotModal({
  open,
  onClose,
  mascotName,
  snapshot,
  ctx,
  level,
  seasonal,
}: {
  open: boolean;
  onClose: () => void;
  mascotName: string;
  snapshot: BullMoodSnapshot;
  ctx: MoodContext | null;
  level: LevelProgress | null;
  seasonal: SeasonalOutfit;
}) {
  const settingsCtx = useSettingsOptional();
  const clientSettings = settingsCtx?.settings ?? null;

  const [mounted, setMounted] = useState(false);
  const [confettiBurst, setConfettiBurst] = useState(false);
  const [motivations, setMotivations] = useState<Motivation[]>([]);
  const [earnedTick, setEarnedTick] = useState(0);
  const cardRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  const earned = useMemo(() => {
    void earnedTick; // re-read whenever the tick bumps
    return loadEarned();
  }, [earnedTick]);

  useEffect(() => setMounted(true), []);
  // Refresh motivations + earned-achievements list each time the modal opens.
  useEffect(() => {
    if (!open) return;
    try {
      const raw = localStorage.getItem("mascot:motivations");
      const arr = raw ? JSON.parse(raw) : [];
      setMotivations(Array.isArray(arr) ? arr.slice(-10).reverse() : []);
    } catch {
      setMotivations([]);
    }
    setEarnedTick((n) => n + 1);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === "Tab" && cardRef.current) {
        const focusables = cardRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, [tabindex]:not([tabindex="-1"])'
        );
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }
    document.addEventListener("keydown", handleKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener("keydown", handleKey);
    };
  }, [open, onClose]);

  function handleMotivate() {
    setConfettiBurst(true);
    try {
      const key = "mascot:motivations";
      const existing = JSON.parse(localStorage.getItem(key) ?? "[]");
      const arr: Motivation[] = Array.isArray(existing) ? existing : [];
      const next = [...arr, { at: new Date().toISOString(), date: todayInCT() }].slice(-50);
      localStorage.setItem(key, JSON.stringify(next));
      setMotivations(next.slice(-10).reverse());
    } catch {
      // ignore — motivations are best-effort
    }
    if (clientSettings?.mascot.soundsEnabled && shouldPlayCue(clientSettings)) {
      playCue("moo");
    }
  }

  function clearMotivations() {
    try {
      localStorage.removeItem("mascot:motivations");
    } catch {
      // ignore
    }
    setMotivations([]);
  }

  if (!mounted) return null;

  const phaseDays =
    snapshot.loading || "error" in snapshot
      ? null
      : daysSince(snapshot.detail.phaseStart);

  const phasePnl =
    snapshot.loading || "error" in snapshot
      ? null
      : snapshot.detail.startingEquity != null
      ? snapshot.detail.equity - snapshot.detail.startingEquity
      : null;

  const phasePct =
    snapshot.loading || "error" in snapshot
      ? null
      : snapshot.detail.startingEquity != null && snapshot.detail.startingEquity > 0
      ? ((snapshot.detail.equity - snapshot.detail.startingEquity) /
          snapshot.detail.startingEquity) *
        100
      : null;

  const alphaVsSpy =
    !snapshot.loading && !("error" in snapshot) && phasePct != null && snapshot.detail.spyPhasePct != null
      ? phasePct - snapshot.detail.spyPhasePct
      : null;

  const headline =
    snapshot.loading || "error" in snapshot
      ? "checking the tape…"
      : MOOD_HEADLINE[snapshot.mood] ?? "trading";

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
        >
          <div
            className="absolute inset-0 bg-black/55 backdrop-blur-sm"
            onClick={onClose}
            aria-hidden="true"
          />
          <motion.div
            ref={cardRef}
            role="dialog"
            aria-modal="true"
            aria-label={`${mascotName} performance recap`}
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ type: "spring", stiffness: 380, damping: 28 }}
            className="relative w-full max-w-lg frost rounded-3xl p-6 shadow-2xl overflow-hidden"
          >
            <Confetti active={confettiBurst} onDone={() => setConfettiBurst(false)} />
            <div className="flex items-start gap-4 relative">
              <div className="shrink-0">
                <BullCharacter
                  mood={!snapshot.loading && !("error" in snapshot) ? snapshot.mood : "neutral"}
                  size="md"
                  seasonal={seasonal}
                />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--color-muted)] font-semibold flex items-center gap-2">
                  <span>{mascotName}</span>
                  {level && (
                    <span className="px-1.5 py-0.5 rounded-full glass-tint-accent text-[9px] tracking-[0.16em]">
                      Lvl {level.current.level} · {level.current.title}
                    </span>
                  )}
                </div>
                <div className="text-2xl font-semibold tracking-tight mt-0.5">{headline}</div>
                {!snapshot.loading && !("error" in snapshot) && (
                  <div className="text-sm text-[var(--color-muted)] mt-1">{snapshot.flavor}</div>
                )}
                {level && level.next && (
                  <LevelProgressBar progress={level} />
                )}
              </div>
              <button
                ref={closeRef}
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="shrink-0 -mt-1 -mr-1 w-8 h-8 inline-flex items-center justify-center rounded-full glass glass-interactive text-[var(--color-muted)] hover:text-[var(--color-text)]"
              >
                ×
              </button>
            </div>

            {/* Today */}
            {!snapshot.loading && !("error" in snapshot) && (
              <div className="mt-5 grid grid-cols-2 gap-3">
                <Stat
                  label="Today P&L"
                  value={fmtSignedMoney(snapshot.detail.dayPnl)}
                  delta={fmtPct(snapshot.detail.dayPct)}
                  tone={colorOf(snapshot.detail.dayPnl)}
                />
                <Stat
                  label="Equity"
                  value={fmtMoney(snapshot.detail.equity)}
                  hint={
                    snapshot.detail.startingEquity != null
                      ? `start ${fmtMoney(snapshot.detail.startingEquity)}`
                      : undefined
                  }
                  tone={null}
                />
                <Stat
                  label="Phase P&L"
                  value={phasePnl != null ? fmtSignedMoney(phasePnl) : "—"}
                  delta={phasePct != null ? fmtPct(phasePct) : null}
                  tone={colorOf(phasePnl)}
                />
                <Stat
                  label="Alpha vs SPY"
                  value={alphaVsSpy != null ? fmtPct(alphaVsSpy) : "—"}
                  hint={
                    snapshot.detail.spyPhasePct != null
                      ? `SPY ${fmtPct(snapshot.detail.spyPhasePct)}`
                      : undefined
                  }
                  tone={colorOf(alphaVsSpy)}
                />
              </div>
            )}

            {/* Risk breakdown */}
            {!snapshot.loading && !("error" in snapshot) && (
              <div className="mt-5">
                <div className="text-[10px] uppercase tracking-[0.14em] text-[var(--color-muted)] font-semibold mb-2">
                  Risk Health · {snapshot.riskHealth}
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <RiskBar
                    label="Deployed"
                    value={snapshot.detail.riskParts.deployedScore}
                    hint={`${Math.round(snapshot.detail.deployed)}% / 75–85%`}
                  />
                  <RiskBar
                    label="Drawdown"
                    value={snapshot.detail.riskParts.drawdownScore}
                    hint={`day ${fmtPct(snapshot.detail.dayPct)}`}
                  />
                  <RiskBar
                    label="Slots"
                    value={snapshot.detail.riskParts.slotsScore}
                    hint={
                      snapshot.detail.positionCount != null
                        ? `${snapshot.detail.positionCount}/6 open`
                        : "—"
                    }
                  />
                </div>
              </div>
            )}

            {/* Career stats */}
            {!snapshot.loading && !("error" in snapshot) && snapshot.detail.phaseStart && (
              <div className="mt-5 pt-5 border-t border-[rgba(255,255,255,0.06)] grid grid-cols-3 gap-3 text-xs">
                <Career label="Phase day" value={phaseDays != null ? `${phaseDays}` : "—"} />
                <Career
                  label="Green-day streak"
                  value={
                    snapshot.detail.winStreak != null
                      ? `${snapshot.detail.winStreak}`
                      : "—"
                  }
                />
                <Career
                  label="Winners open"
                  value={
                    snapshot.detail.winningPositionCount != null && snapshot.detail.positionCount != null
                      ? `${snapshot.detail.winningPositionCount}/${snapshot.detail.positionCount}`
                      : "—"
                  }
                />
              </div>
            )}

            {/* Recap sparkline */}
            {ctx?.recentRows && ctx.recentRows.length >= 2 && (
              <div className="mt-5">
                <div className="text-[10px] uppercase tracking-[0.14em] text-[var(--color-muted)] font-semibold mb-2">
                  Last {ctx.recentRows.length} sessions
                </div>
                <Sparkline rows={ctx.recentRows} />
              </div>
            )}

            {/* Achievements grid */}
            <div className="mt-5">
              <div className="text-[10px] uppercase tracking-[0.14em] text-[var(--color-muted)] font-semibold mb-2">
                Achievements · {Object.keys(earned).length}/{ACHIEVEMENTS.length}
              </div>
              <div className="grid grid-cols-3 gap-2">
                {ACHIEVEMENTS.map((a) => {
                  const isEarned = Boolean(earned[a.id]);
                  return (
                    <div
                      key={a.id}
                      title={`${a.label} — ${a.description}${
                        isEarned ? ` (earned ${earned[a.id]})` : ""
                      }`}
                      className={clsx(
                        "frost rounded-xl p-2 flex items-center gap-2 transition-opacity",
                        isEarned ? "opacity-100" : "opacity-40 grayscale"
                      )}
                    >
                      <span className="text-lg" aria-hidden="true">
                        {a.icon}
                      </span>
                      <span className="text-[10px] leading-tight font-medium">
                        {a.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="mt-6 flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={handleMotivate}
                className="glass glass-interactive glass-tint-accent rounded-full px-4 py-1.5 text-xs font-semibold"
              >
                Motivate {mascotName}
              </button>
              <span className="text-[10px] text-[var(--color-muted)]">
                Adds a cheer to your local feed.
              </span>
            </div>

            {/* Motivations feed */}
            {motivations.length > 0 && (
              <div className="mt-5 pt-5 border-t border-[rgba(255,255,255,0.06)]">
                <div className="flex items-baseline justify-between mb-2">
                  <div className="text-[10px] uppercase tracking-[0.14em] text-[var(--color-muted)] font-semibold">
                    Recent cheers
                  </div>
                  <button
                    type="button"
                    onClick={clearMotivations}
                    className="text-[10px] text-[var(--color-muted)] hover:text-[var(--color-down)]"
                  >
                    Clear
                  </button>
                </div>
                <ul className="text-xs space-y-1 max-h-32 overflow-y-auto">
                  {motivations.map((m, i) => (
                    <li key={`${m.at}-${i}`} className="text-[var(--color-muted)] tabular">
                      <span className="text-[var(--color-up)] mr-2">▸</span>
                      Cheered on {fmtDateTimeCT(m.at)}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {snapshot.loading === false && "error" in snapshot && (
              <div className="mt-4 text-xs text-[var(--color-down)]">
                Couldn&apos;t reach Alpaca: {snapshot.error}
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}

function daysSince(iso: string | null): number | null {
  if (!iso) return null;
  const start = new Date(`${iso}T00:00:00Z`).getTime();
  const today = todayInCT();
  // Use addDaysISO/iso math to keep this TZ-stable.
  const tNow = new Date(`${today}T00:00:00Z`).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(tNow)) return null;
  return Math.max(0, Math.round((tNow - start) / (24 * 3600 * 1000)));
}

