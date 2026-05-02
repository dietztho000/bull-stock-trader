"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChatPanel } from "./ChatPanel";

export function ChatLauncher() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <AnimatePresence>
        {!open && (
          <motion.button
            key="launcher"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ type: "spring", stiffness: 380, damping: 28 }}
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.96 }}
            onClick={() => setOpen(true)}
            style={{ transformOrigin: "bottom right" }}
            className="fixed bottom-6 right-6 sm:bottom-8 sm:right-8 z-40 px-4 py-2.5 rounded-full glass glass-interactive glass-tint-accent text-sm font-medium text-[var(--color-text)] flex items-center gap-2 shadow-2xl"
            aria-label="Open chat with the bot"
          >
            <SparkleIcon />
            <span>Ask the bot</span>
          </motion.button>
        )}
      </AnimatePresence>
      {open && <ChatPanel onClose={() => setOpen(false)} />}
    </>
  );
}

function SparkleIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M8 1.5 L9.5 6.5 L14.5 8 L9.5 9.5 L8 14.5 L6.5 9.5 L1.5 8 L6.5 6.5 Z" />
    </svg>
  );
}
