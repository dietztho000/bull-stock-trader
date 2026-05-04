"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const COLORS = [
  "var(--color-up)",
  "var(--color-accent)",
  "var(--color-warn)",
  "#f4d35e",
  "#ee964b",
];

const PARTICLE_COUNT = 28;

type Particle = {
  id: number;
  x: number;
  y: number;
  rot: number;
  delay: number;
  color: string;
  size: number;
  drift: number;
};

function makeParticles(seed: number): Particle[] {
  const rand = mulberry32(seed);
  return Array.from({ length: PARTICLE_COUNT }, (_, i) => ({
    id: i,
    x: rand() * 100,
    y: rand() * 30,
    rot: rand() * 360,
    delay: rand() * 0.25,
    color: COLORS[Math.floor(rand() * COLORS.length)],
    size: 4 + rand() * 6,
    drift: (rand() - 0.5) * 80,
  }));
}

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function Confetti({
  active,
  durationMs = 2400,
  onDone,
}: {
  active: boolean;
  durationMs?: number;
  onDone?: () => void;
}) {
  const [particles, setParticles] = useState<Particle[] | null>(null);

  useEffect(() => {
    if (!active) {
      setParticles(null);
      return;
    }
    setParticles(makeParticles(Date.now()));
    const t = setTimeout(() => {
      setParticles(null);
      onDone?.();
    }, durationMs);
    return () => clearTimeout(t);
  }, [active, durationMs, onDone]);

  return (
    <AnimatePresence>
      {particles && (
        <div className="pointer-events-none absolute inset-0 overflow-visible" aria-hidden="true">
          {particles.map((p) => (
            <motion.span
              key={p.id}
              initial={{ x: `${p.x}%`, y: `${p.y}%`, opacity: 0, rotate: p.rot, scale: 0.6 }}
              animate={{
                x: `calc(${p.x}% + ${p.drift}px)`,
                y: `${p.y + 110}%`,
                opacity: [0, 1, 1, 0],
                rotate: p.rot + 540,
                scale: [0.6, 1, 1, 0.4],
              }}
              transition={{
                duration: durationMs / 1000,
                delay: p.delay,
                ease: "easeOut",
              }}
              className="absolute top-0 left-0 rounded-[2px]"
              style={{
                width: p.size,
                height: p.size * 0.5,
                backgroundColor: p.color,
              }}
            />
          ))}
        </div>
      )}
    </AnimatePresence>
  );
}
