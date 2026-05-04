"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  ACHIEVEMENTS,
  type AchievementId,
} from "@/lib/mascot/achievements";

type Toast = {
  id: number;
  achievement: (typeof ACHIEVEMENTS)[number];
};

let toastSeq = 0;
const listeners = new Set<(t: Toast) => void>();

export function emitAchievementToast(id: AchievementId) {
  const a = ACHIEVEMENTS.find((x) => x.id === id);
  if (!a) return;
  const t: Toast = { id: ++toastSeq, achievement: a };
  for (const l of listeners) l(t);
}

const TOAST_LIFETIME_MS = 5000;

export function AchievementToastHost() {
  const [mounted, setMounted] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    setMounted(true);
    function add(t: Toast) {
      setToasts((prev) => [...prev, t]);
      window.setTimeout(() => {
        setToasts((prev) => prev.filter((x) => x.id !== t.id));
      }, TOAST_LIFETIME_MS);
    }
    listeners.add(add);
    return () => {
      listeners.delete(add);
    };
  }, []);

  if (!mounted) return null;

  return createPortal(
    <div
      aria-live="polite"
      aria-atomic="true"
      className="fixed top-20 left-1/2 -translate-x-1/2 z-[55] flex flex-col gap-2 items-center"
    >
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            initial={{ opacity: 0, y: -10, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.96 }}
            transition={{ type: "spring", stiffness: 380, damping: 28 }}
            className="glass glass-tint-up rounded-2xl px-4 py-2.5 flex items-center gap-3 shadow-2xl max-w-sm"
            role="status"
          >
            <span className="text-2xl" aria-hidden="true">
              {t.achievement.icon}
            </span>
            <div className="min-w-0">
              <div className="text-[10px] uppercase tracking-[0.16em] text-[var(--color-up)] font-bold">
                Achievement unlocked
              </div>
              <div className="text-sm font-semibold tracking-tight truncate">
                {t.achievement.label}
              </div>
              <div className="text-xs text-[var(--color-muted)] truncate">
                {t.achievement.description}
              </div>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>,
    document.body
  );
}
