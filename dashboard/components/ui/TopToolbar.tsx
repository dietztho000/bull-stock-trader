import { Suspense } from "react";
import { cookies } from "next/headers";
import { ModeBadge } from "@/components/ModeBadge";
import { MarketClock } from "@/components/live/MarketClock";
import { DiscordBriefButton } from "@/components/research/DiscordBriefButton";
import { MemoryFreshness } from "@/components/MemoryFreshness";
import { AccountSelector } from "@/components/ui/AccountSelector";
import { readBotMode } from "@/lib/mode";
import { listBots } from "@/lib/settings";

const SLUG_RE = /^[a-z0-9][a-z0-9-]*$/;

/** Resolves the active bot for the server-rendered toolbar (follow-up #4).
 *
 *  Reads the `bst-active-bot` cookie set by `tradingAccountContext` whenever
 *  the user picks a bot client-side. Falls back to the legacy BOT_MODE if
 *  the cookie is absent or names a bot that isn't in the registry — that
 *  way a stale cookie pointing at a deleted bot doesn't break the badge. */
async function resolveActiveBotId(): Promise<string> {
  const fallback = await readBotMode();
  const store = await cookies();
  const raw = store.get("bst-active-bot")?.value;
  if (!raw || !SLUG_RE.test(raw)) return fallback;
  const bots = await listBots().catch(() => []);
  if (bots.some((b) => b.id === raw)) return raw;
  // Audit A1 shim — a stale cookie carrying the pre-rename "live"/"paper"
  // slug should resolve to the renamed `legacy-*` id if it exists, so a
  // long-lived browser session keeps working after the dashboard upgrades.
  if (raw === "live" && bots.some((b) => b.id === "legacy-live")) return "legacy-live";
  if (raw === "paper" && bots.some((b) => b.id === "legacy-paper")) return "legacy-paper";
  // Legacy seeded "live"/"paper" ids don't exist as registry bots on a
  // pre-migration install — accept them anyway since they double as
  // valid memory-tree directory names.
  if (raw === "live" || raw === "paper") return raw;
  return fallback;
}

export async function TopToolbar() {
  const activeBotId = await resolveActiveBotId();
  return (
    <header className="sticky top-0 z-30 px-4 pt-4 pb-3">
      <div className="glass rounded-full pl-4 pr-3 py-2 flex items-center gap-3 flex-wrap">
        <div className="flex items-baseline gap-2 mr-auto">
          <span className="text-[10px] uppercase tracking-[0.18em] text-[var(--color-muted)] font-semibold">
            Bull
          </span>
          <span className="text-sm font-semibold tracking-tight">
            Stock Trader
          </span>
        </div>
        <AccountSelector />
        <ModeBadge />
        <MarketClock />
        <Suspense fallback={null}>
          <MemoryFreshness botId={activeBotId} />
        </Suspense>
        <DiscordBriefButton />
      </div>
    </header>
  );
}
