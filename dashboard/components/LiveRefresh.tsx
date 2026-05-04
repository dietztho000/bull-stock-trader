"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useTradingAccountOptional } from "@/lib/tradingAccountContext";

type Payload = {
  bots: string[];
  firstAt: number;
  events: Array<{ file: string; bot: string | null; strategy: string | null; relPath: string }>;
};

/** Per-route file allow-lists. When the current pathname has an entry, the
 *  refresh only fires if at least one event file matches the list. Routes
 *  not listed fall back to the default "any shared or active-bot file"
 *  policy, so this is purely additive — adding a new page without an entry
 *  preserves prior behavior (audit H1). */
const ROUTE_ALLOW_LISTS: Record<string, ReadonlySet<string>> = {
  "/trades": new Set([
    "TRADE-LOG.md",
    "SECTOR-LEDGER.md",
    "dashboard-settings.json",
  ]),
  "/calendar": new Set([
    "ECONOMIC-CALENDAR.md",
    "MARKET-EARNINGS.md",
    "EARNINGS-CALENDAR.md",
    "dashboard-settings.json",
  ]),
  "/bots": new Set(["dashboard-settings.json"]),
  "/strategy": new Set(["TRADING-STRATEGY.md", "dashboard-settings.json"]),
};

/** Subscribes to the server's memory-event SSE stream and triggers
 *  `router.refresh()` ONLY when the changed batch touches the bot the user
 *  is currently viewing — or a shared file (every tab cares about
 *  SECTOR-MAP, ECONOMIC-CALENDAR, etc.). With N bots writing to memory in
 *  parallel from cron routines, the previous implementation was issuing
 *  N refreshes/sec to every connected tab (audit P4). */
export function LiveRefresh() {
  const router = useRouter();
  const pathname = usePathname();
  const ctx = useTradingAccountOptional();
  const activeBot = ctx?.botId ?? null;
  // Track unclassified relPaths we've already warned about so we don't spam
  // the console on every memory write — audit P6.
  const warnedPathsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const allowList = ROUTE_ALLOW_LISTS[pathname] ?? null;
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
        // Pages with an allow-list short-circuit unrelated writes — e.g.
        // /trades doesn't need to re-render when the economic calendar
        // updates, even though it's a "shared" file. Unknown layouts always
        // fall through (better safe than stale).
        if (allowList && !unknownBot) {
          const matches = payload.events.some((e) => allowList.has(e.file));
          if (!matches) return;
          router.refresh();
          return;
        }
        // Default policy: refresh on shared file change, the active bot's
        // file change, or an unclassified write.
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
  }, [router, activeBot, pathname]);
  return null;
}
