"use client";

import { useAlertWatcher } from "@/lib/useAlertWatcher";

/** Headless component — runs the alert watcher hook from inside the
 *  ToastProvider tree. Renders nothing. */
export function AlertWatcher() {
  useAlertWatcher();
  return null;
}
