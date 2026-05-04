"use client";

import Link from "next/link";
import { Card, Badge } from "@/components/ui/Card";
import { useStrategyState } from "@/lib/useStrategyState";

/** Surfaces earnings-gate (rule #13), cooldowns (rule #20), and sector
 *  saturation (rule #17) in a glanceable Overview tile so users notice them
 *  without opening the calendar or trades pages. */
export function EarningsGateBanner() {
  const { data, loading } = useStrategyState();

  if (loading && !data) {
    return (
      <Card title="Risk gate">
        <div className="text-xs text-[var(--color-muted)]">Loading rule state…</div>
      </Card>
    );
  }

  if (!data) {
    return null;
  }

  const hasEarnings = data.earningsT2Held.length > 0;
  const hasCooldowns = data.cooldownSymbols.length > 0;
  const hasBlocked = data.blockedSectors.length > 0;
  const hasCap = data.sectorsAtCap.length > 0;
  const hasBlockedIdeas = data.blockedIdeas.length > 0;

  if (!hasEarnings && !hasCooldowns && !hasBlocked && !hasCap && !hasBlockedIdeas) {
    return (
      <Card title="Risk gate" subtitle="No active rules blocking entries today.">
        <div className="text-xs text-[var(--color-up)]">
          ✓ Sector room available · No earnings within gate · No active cooldowns.
        </div>
      </Card>
    );
  }

  return (
    <Card
      title="Risk gate"
      subtitle="Rules currently shaping today's tradeable universe."
      right={
        <Link
          href="/calendar"
          className="text-[11px] text-[var(--color-muted)] hover:text-[var(--color-accent)]"
        >
          Open calendar →
        </Link>
      }
    >
      <div className="space-y-2.5 text-xs">
        {hasEarnings && (
          <div>
            <div className="text-[10px] uppercase tracking-[0.14em] text-[var(--color-warn)] font-semibold mb-1">
              📅 Earnings gate (rule #13)
            </div>
            <ul className="space-y-1">
              {data.earningsT2Held.map((e) => (
                <li key={e.symbol} className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold tabular">{e.symbol}</span>
                  <Badge tone={e.daysUntil === 0 ? "down" : "warn"}>
                    {e.daysUntil === 0
                      ? `EPS today${e.type ? ` (${e.type})` : ""}`
                      : `EPS in ${e.daysUntil}d${e.type ? ` (${e.type})` : ""}`}
                  </Badge>
                  <Link
                    href={`/trades?force=${encodeURIComponent(e.symbol)}`}
                    className="text-[10px] text-[var(--color-accent)] hover:underline"
                  >
                    Force-exit at close →
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}

        {hasCap && (
          <div>
            <div className="text-[10px] uppercase tracking-[0.14em] text-[var(--color-warn)] font-semibold mb-1">
              🚧 Sector cap reached (rule #17)
            </div>
            <div className="flex flex-wrap gap-1.5">
              {data.sectorsAtCap.map((s) => (
                <Badge key={s} tone="warn">{s}</Badge>
              ))}
            </div>
          </div>
        )}

        {hasBlocked && (
          <div>
            <div className="text-[10px] uppercase tracking-[0.14em] text-[var(--color-down)] font-semibold mb-1">
              ❄️ Sector cooling off (rule #10)
            </div>
            <div className="flex flex-wrap gap-1.5">
              {data.blockedSectors.map((s) => (
                <Badge key={s} tone="down">{s}</Badge>
              ))}
            </div>
          </div>
        )}

        {hasCooldowns && (
          <div>
            <div className="text-[10px] uppercase tracking-[0.14em] text-[var(--color-muted)] font-semibold mb-1">
              ⏳ Re-entry cooldown (rule #20)
            </div>
            <ul className="space-y-0.5">
              {data.cooldownSymbols.map((c) => (
                <li key={c.symbol} className="flex items-baseline gap-2">
                  <span className="font-semibold tabular">{c.symbol}</span>
                  <span className="text-[var(--color-muted)] text-[11px]">
                    unlocks in {c.daysRemaining}d (stopped {c.lastLossDate})
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {hasBlockedIdeas && (
          <div>
            <div className="text-[10px] uppercase tracking-[0.14em] text-[var(--color-muted)] font-semibold mb-1">
              🚫 Today's ideas the rules would reject
            </div>
            <ul className="space-y-0.5">
              {data.blockedIdeas.slice(0, 5).map((i) => (
                <li key={`${i.symbol}-${i.reason}`} className="flex items-baseline gap-2">
                  <span className="font-semibold tabular">{i.symbol}</span>
                  <span className="text-[var(--color-muted)] text-[11px]">
                    {i.reason} · {i.detail}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="pt-1.5 border-t border-[rgba(255,255,255,0.05)] text-[10px] text-[var(--color-muted)]">
          Slots used: {data.slotsUsed}/{data.slotsCap}
        </div>
      </div>
    </Card>
  );
}
