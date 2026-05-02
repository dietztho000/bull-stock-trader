import { Suspense } from "react";
import { ModeBadge } from "@/components/ModeBadge";
import { MarketClock } from "@/components/live/MarketClock";
import { DiscordBriefButton } from "@/components/research/DiscordBriefButton";
import { MemoryFreshness } from "@/components/MemoryFreshness";
import { AccountSelector } from "@/components/ui/AccountSelector";

export function TopToolbar() {
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
          <MemoryFreshness />
        </Suspense>
        <DiscordBriefButton />
      </div>
    </header>
  );
}
