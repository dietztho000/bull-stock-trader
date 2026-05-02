"use client";

import { LayoutGroup, AnimatePresence, motion } from "framer-motion";
import type { ReactNode } from "react";

export function MorphContainer({
  id,
  children,
}: {
  id: string;
  children: ReactNode;
}) {
  return <LayoutGroup id={id}>{children}</LayoutGroup>;
}

export function MorphPresence({
  childKey,
  children,
}: {
  childKey: string;
  children: ReactNode;
}) {
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={childKey}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -6 }}
        transition={{ type: "spring", stiffness: 300, damping: 28 }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
