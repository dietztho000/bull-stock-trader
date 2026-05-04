"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useTradingAccountOptional } from "@/lib/tradingAccountContext";

type Payload = {
  bots: string[];
  firstAt: number;
  events: Array<{ file: string; bot: string | null; strategy: string | null; relPath: string }>;
};

/** Subscribes to the server's memory-event SSE stream and triggers
 *  `router.refresh()` ONLY when the changed batch touches the bot the user
 *  is currently viewing — or a shared file (every tab cares about
 *  SECTOR-MAP, ECONOMIC-CALENDAR, etc.). With N bots writing to memory in
 *  parallel from cron routines, the previous implementation was issuing
 *  N refreshes/sec to every connected tab (audit P4). */
export function LiveRefresh() {
  const router = useRouter();
  const ctx = useTradingAccountOptional();
  const activeBot = ctx?.botId ?? null;
  // Track unclassified relPaths we've already warned about so we don't spam
  // the console on every memory write — audit P6.
  const warnedPathsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const es = new EventSource("/api/stream");
    es.onmessage = (msg) => {
      try {
        const payload: Payload = JSON.parse(msg.data);
        const touchedShared = payload.bots.includes("shared");
        const touchedActive = activeBot != null && payload.bots.includes(activeBot);
        const unknownEvents = payload.events.filter((e) => e.bot == null);
        const unknownBot = unknownEvents.length > 0;
        if (unknownBot) {
          // Once per unique path: surface the file family that the watcher's
          // classifier doesn't recognize, so a developer can extend
          // MEMORY_FILE_SCOPE in lib/memoryPath.ts.
          for (const ev of unknownEvents) {
            if (warnedPathsRef.current.has(ev.relPath)) continue;
            warnedPathsRef.current.add(ev.relPath);
            // eslint-disable-next-line no-console
            console.warn(
              `[LiveRefresh] memory write ignored bot classification: ${ev.relPath} (${ev.file}). ` +
                `If this file should be per-bot or shared, add it to MEMORY_FILE_SCOPE in lib/memoryPath.ts.`
            );
          }
        }
        // Refresh on: shared file change, the active bot's file change, or an
        // unclassified write (probably legacy layout — better safe than stale).
        // Other bots' writes are ignored for this tab.
        if (touchedShared || touchedActive || unknownBot) {
          router.refresh();
        }
      } catch {
        // Heartbeat or malformed payload — ignore.
      }
    };
    es.onerror = () => {
      // browser auto-reconnects
    };
    return () => es.close();
  }, [router, activeBot]);
  return null;
}
