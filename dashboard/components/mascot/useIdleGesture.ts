"use client";

import { useEffect, useState } from "react";
import { useReducedMotion } from "framer-motion";

type Gesture = "blink" | "happy" | null;

const MIN_INTERVAL_MS = 30_000;
const MAX_INTERVAL_MS = 60_000;
const GESTURE_DURATION_MS = 1500;

/**
 * Drives random idle gestures on the mascot. Uses `Math.random` so it MUST
 * NOT run during SSR — the hook gates everything behind a `mounted` flag.
 */
export function useIdleGesture(enabled: boolean): Gesture {
  const reduced = useReducedMotion();
  const [gesture, setGesture] = useState<Gesture>(null);

  useEffect(() => {
    if (!enabled || reduced) return;
    let cancelled = false;
    let timer: number | null = null;

    function schedule() {
      const wait =
        MIN_INTERVAL_MS + Math.random() * (MAX_INTERVAL_MS - MIN_INTERVAL_MS);
      timer = window.setTimeout(() => {
        if (cancelled) return;
        const pick: Gesture = Math.random() < 0.4 ? "happy" : "blink";
        setGesture(pick);
        window.setTimeout(() => {
          if (!cancelled) setGesture(null);
          schedule();
        }, GESTURE_DURATION_MS);
      }, wait);
    }
    schedule();

    return () => {
      cancelled = true;
      if (timer != null) window.clearTimeout(timer);
    };
  }, [enabled, reduced]);

  return gesture;
}

/**
 * Tap-to-pet: show "happy" gesture briefly. Returns the trigger fn + current
 * gesture override (which takes precedence over the auto idle gesture).
 */
export function useTapToPet(): {
  petGesture: Gesture;
  triggerPet: () => void;
} {
  const [petGesture, setPetGesture] = useState<Gesture>(null);
  function triggerPet() {
    setPetGesture("happy");
    window.setTimeout(() => setPetGesture(null), 1400);
  }
  return { petGesture, triggerPet };
}
