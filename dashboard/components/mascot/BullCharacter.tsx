"use client";

import { motion } from "framer-motion";
import clsx from "clsx";
import type { SeasonalOutfit } from "@/lib/mascot/seasonal";

export type Mood = "bullish" | "bearish" | "neutral" | "celebrating";
export type Size = "sm" | "md" | "lg";

const SIZE_PX: Record<Size, number> = { sm: 56, md: 140, lg: 220 };

const SPRING = { type: "spring" as const, stiffness: 380, damping: 28 };

const SEASONAL_EMOJI: Record<NonNullable<SeasonalOutfit>, string> = {
  halloween: "🎃",
  thanksgiving: "🦃",
  christmas: "🎅",
  newyear: "🎊",
};

export function BullCharacter({
  mood,
  size = "md",
  seasonal = null,
  idleGesture = null,
  className,
}: {
  mood: Mood;
  size?: Size;
  seasonal?: SeasonalOutfit;
  /** Optional one-shot idle gesture overlay (managed by parent timer). */
  idleGesture?: "blink" | "happy" | null;
  className?: string;
}) {
  const px = SIZE_PX[size];
  const tone =
    mood === "bullish" || mood === "celebrating"
      ? "var(--color-up)"
      : mood === "bearish"
      ? "var(--color-down)"
      : "var(--color-accent)";

  const bodyVariants = {
    bullish: { rotate: 0, y: -2 },
    bearish: { rotate: -2.5, y: 2 },
    neutral: { rotate: 0, y: 0 },
    celebrating: { rotate: 0, y: -3, scale: 1.04 },
  };

  return (
    <div
      className={clsx("relative inline-flex items-center justify-center", className)}
      style={{ width: px, height: px }}
      aria-hidden="true"
    >
      {/* Soft mood-tinted glow */}
      <div
        className="absolute inset-0 rounded-full blur-2xl opacity-60 transition-colors duration-500"
        style={{
          background: `radial-gradient(circle at center, ${tone} 0%, transparent 70%)`,
          opacity: mood === "neutral" ? 0.25 : 0.45,
        }}
      />

      {/* Mood accessory above head */}
      <MoodAccessory mood={mood} px={px} />

      {/* Seasonal accessory (overrides nothing — sits next to mood accessory) */}
      {seasonal && (
        <motion.div
          className="absolute"
          style={{
            top: -px * 0.18,
            left: "50%",
            transform: "translateX(-50%)",
            fontSize: Math.max(px * 0.22, 16),
            zIndex: 2,
          }}
          initial={{ y: -4, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.4 }}
          aria-label={`Seasonal outfit: ${seasonal}`}
        >
          {SEASONAL_EMOJI[seasonal]}
        </motion.div>
      )}

      {/* Idle gesture overlay */}
      {idleGesture === "happy" && (
        <motion.div
          className="absolute"
          style={{ left: -px * 0.05, top: px * 0.18, fontSize: Math.max(px * 0.18, 14) }}
          initial={{ opacity: 0, scale: 0.7 }}
          animate={{ opacity: [0, 1, 1, 0], scale: [0.7, 1.1, 1, 0.9] }}
          transition={{ duration: 1.4 }}
        >
          💛
        </motion.div>
      )}

      {/* Idle bob/sway anchored to mood */}
      <motion.div
        className="relative"
        style={{ width: px * 0.78, height: px * 0.78, transformOrigin: "center bottom" }}
        animate={mood === "celebrating" ? "celebrating" : mood}
        variants={bodyVariants}
        transition={SPRING}
      >
        <motion.div
          className="absolute inset-0"
          animate={{ y: [0, -3, 0] }}
          transition={{ duration: mood === "celebrating" ? 0.9 : 2.6, repeat: Infinity, ease: "easeInOut" }}
        >
          <BullHeadSvg mood={mood} />
        </motion.div>
      </motion.div>

      {/* Body details only on larger renders */}
      {size !== "sm" && <Tie px={px} mood={mood} />}
    </div>
  );
}

function BullHeadSvg({ mood }: { mood: Mood }) {
  const eyeY = mood === "bearish" ? 108 : 102;
  const browAngle = mood === "bullish" || mood === "celebrating" ? -8 : mood === "bearish" ? 6 : 0;
  const mouthPath =
    mood === "celebrating"
      ? "M 100 152 Q 120 172 140 152"
      : mood === "bullish"
      ? "M 102 150 Q 120 162 138 150"
      : mood === "bearish"
      ? "M 102 162 Q 120 150 138 162"
      : "M 104 156 L 136 156";

  return (
    <svg viewBox="0 0 240 240" width="100%" height="100%" role="img">
      <defs>
        <linearGradient id="bullCoat" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#8a5a3b" />
          <stop offset="100%" stopColor="#5a3923" />
        </linearGradient>
        <linearGradient id="hornGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f1e7d4" />
          <stop offset="100%" stopColor="#b8a880" />
        </linearGradient>
        <linearGradient id="snoutGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#d8b298" />
          <stop offset="100%" stopColor="#a07556" />
        </linearGradient>
      </defs>

      {/* Ears */}
      <ellipse cx="62" cy="108" rx="22" ry="14" fill="url(#bullCoat)" transform="rotate(-25 62 108)" />
      <ellipse cx="178" cy="108" rx="22" ry="14" fill="url(#bullCoat)" transform="rotate(25 178 108)" />

      {/* Horns */}
      <path
        d="M 70 86 Q 38 60 30 36 Q 60 50 86 76 Z"
        fill="url(#hornGrad)"
        stroke="rgba(0,0,0,0.18)"
        strokeWidth="1"
      />
      <path
        d="M 170 86 Q 202 60 210 36 Q 180 50 154 76 Z"
        fill="url(#hornGrad)"
        stroke="rgba(0,0,0,0.18)"
        strokeWidth="1"
      />

      {/* Head */}
      <ellipse cx="120" cy="124" rx="74" ry="68" fill="url(#bullCoat)" />

      {/* Forehead tuft */}
      <path
        d="M 96 70 Q 120 56 144 70 Q 132 82 120 80 Q 108 82 96 70 Z"
        fill="#3b2614"
        opacity="0.85"
      />

      {/* Snout */}
      <ellipse cx="120" cy="160" rx="44" ry="30" fill="url(#snoutGrad)" />
      <ellipse cx="106" cy="158" rx="3.5" ry="5" fill="#2a1810" />
      <ellipse cx="134" cy="158" rx="3.5" ry="5" fill="#2a1810" />

      {/* Brow */}
      <g transform={`rotate(${browAngle} 96 92)`}>
        <rect x="80" y="89" width="32" height="5" rx="2.5" fill="#2a1810" />
      </g>
      <g transform={`rotate(${-browAngle} 144 92)`}>
        <rect x="128" y="89" width="32" height="5" rx="2.5" fill="#2a1810" />
      </g>

      {/* Eyes */}
      <g>
        <circle cx="96" cy={eyeY} r="7" fill="#fafafa" />
        <circle cx="144" cy={eyeY} r="7" fill="#fafafa" />
        {mood === "celebrating" ? (
          <>
            <path d="M 90 102 L 102 102" stroke="#1c0e06" strokeWidth="3" strokeLinecap="round" />
            <path d="M 138 102 L 150 102" stroke="#1c0e06" strokeWidth="3" strokeLinecap="round" />
          </>
        ) : (
          <>
            <circle cx="97" cy={eyeY + 1} r="3.4" fill="#1c0e06" />
            <circle cx="145" cy={eyeY + 1} r="3.4" fill="#1c0e06" />
            <circle cx="98.5" cy={eyeY - 0.5} r="1.1" fill="#fff" />
            <circle cx="146.5" cy={eyeY - 0.5} r="1.1" fill="#fff" />
          </>
        )}
      </g>

      {/* Nostrils */}
      <ellipse cx="108" cy="170" rx="3" ry="4.5" fill="#2a1810" opacity="0.7" />
      <ellipse cx="132" cy="170" rx="3" ry="4.5" fill="#2a1810" opacity="0.7" />

      {/* Nose ring */}
      <circle
        cx="120"
        cy="184"
        r="6"
        fill="none"
        stroke="#d4af37"
        strokeWidth="2.4"
      />

      {/* Mouth */}
      <path d={mouthPath} stroke="#2a1810" strokeWidth="3" fill="none" strokeLinecap="round" />

      {/* Sweat (bearish) */}
      {mood === "bearish" && (
        <path
          d="M 188 96 Q 184 110 188 116 Q 192 110 188 96 Z"
          fill="#7ec8e3"
          opacity="0.85"
        />
      )}
    </svg>
  );
}

function MoodAccessory({ mood, px }: { mood: Mood; px: number }) {
  if (mood === "celebrating") {
    return (
      <motion.div
        className="absolute"
        style={{ top: -8, fontSize: Math.max(px * 0.18, 14) }}
        animate={{ y: [-2, -6, -2], rotate: [-6, 8, -6] }}
        transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
      >
        🎉
      </motion.div>
    );
  }
  if (mood === "bearish") {
    return (
      <motion.div
        className="absolute"
        style={{ top: -px * 0.05, right: px * 0.08, fontSize: Math.max(px * 0.16, 12) }}
        animate={{ y: [0, -3, 0], opacity: [0.6, 1, 0.6] }}
        transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
      >
        ⛈️
      </motion.div>
    );
  }
  if (mood === "bullish") {
    return (
      <motion.div
        className="absolute"
        style={{ top: -px * 0.04, right: -px * 0.04, fontSize: Math.max(px * 0.16, 12) }}
        animate={{ rotate: [-6, 6, -6] }}
        transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
      >
        👍
      </motion.div>
    );
  }
  return null;
}

function Tie({ px, mood }: { px: number; mood: Mood }) {
  const color =
    mood === "bullish" || mood === "celebrating"
      ? "var(--color-up)"
      : mood === "bearish"
      ? "var(--color-down)"
      : "var(--color-accent)";
  return (
    <svg
      viewBox="0 0 240 80"
      style={{
        position: "absolute",
        bottom: -px * 0.08,
        left: 0,
        width: "100%",
        height: px * 0.34,
        pointerEvents: "none",
      }}
      aria-hidden="true"
    >
      <path
        d="M 110 4 L 130 4 L 134 18 L 152 72 L 120 80 L 88 72 L 106 18 Z"
        fill={color}
        opacity="0.85"
      />
      <path
        d="M 112 6 L 128 6 L 130 14 L 110 14 Z"
        fill="rgba(0,0,0,0.25)"
      />
    </svg>
  );
}
