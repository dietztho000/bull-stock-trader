"use client";

/**
 * Tiny Web Audio synth for mascot cues. No asset loading — every cue is a
 * short procedural envelope generated on demand. Strict opt-in: callers must
 * pass `enabled` and respect quiet-hours from the notifications settings.
 */

import { isInQuietHours } from "@/lib/settings.schema";
import type { DashboardSettings } from "@/lib/settings.schema";

type QuietHoursAware = {
  notifications: Pick<DashboardSettings["notifications"], "quietHours">;
};

let ctx: AudioContext | null = null;

function ensureCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (ctx) return ctx;
  try {
    type AudioCtor = typeof AudioContext;
    type WindowWithWebkit = Window & { webkitAudioContext?: AudioCtor };
    const W = window as WindowWithWebkit;
    const Ctor = window.AudioContext ?? W.webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
    return ctx;
  } catch {
    return null;
  }
}

export type Cue = "ding" | "moo" | "thunder";

export function shouldPlayCue(settings: QuietHoursAware | null | undefined): boolean {
  if (!settings) return false;
  // Sounds are nested under notifications quiet-hours so a single quiet
  // window covers all dashboard noise.
  if (settings.notifications.quietHours.enabled) {
    const { startCT, endCT } = settings.notifications.quietHours;
    if (isInQuietHours(startCT, endCT)) return false;
  }
  return true;
}

export function playCue(cue: Cue) {
  const c = ensureCtx();
  if (!c) return;
  // Resume context on the first user-gesture-driven call.
  if (c.state === "suspended") {
    c.resume().catch(() => undefined);
  }
  switch (cue) {
    case "ding":
      blip(c, { freq: 880, duration: 0.18, type: "sine", gain: 0.18 });
      break;
    case "moo":
      sweep(c, { from: 320, to: 110, duration: 0.45, type: "sawtooth", gain: 0.22 });
      break;
    case "thunder":
      sweep(c, { from: 90, to: 40, duration: 0.85, type: "triangle", gain: 0.32 });
      break;
  }
}

function blip(
  c: AudioContext,
  opts: { freq: number; duration: number; type: OscillatorType; gain: number }
) {
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = opts.type;
  osc.frequency.value = opts.freq;
  g.gain.setValueAtTime(0.0001, c.currentTime);
  g.gain.exponentialRampToValueAtTime(opts.gain, c.currentTime + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + opts.duration);
  osc.connect(g).connect(c.destination);
  osc.start();
  osc.stop(c.currentTime + opts.duration + 0.02);
}

function sweep(
  c: AudioContext,
  opts: { from: number; to: number; duration: number; type: OscillatorType; gain: number }
) {
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = opts.type;
  osc.frequency.setValueAtTime(opts.from, c.currentTime);
  osc.frequency.exponentialRampToValueAtTime(
    Math.max(20, opts.to),
    c.currentTime + opts.duration
  );
  g.gain.setValueAtTime(0.0001, c.currentTime);
  g.gain.exponentialRampToValueAtTime(opts.gain, c.currentTime + 0.04);
  g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + opts.duration);
  osc.connect(g).connect(c.destination);
  osc.start();
  osc.stop(c.currentTime + opts.duration + 0.05);
}
