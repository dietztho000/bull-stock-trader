"use client";

import useSWR from "swr";
import { useMemo, useState } from "react";
import { Card } from "@/components/ui/Card";
import type { Bot, StrategyDefinition } from "@/lib/settings";
import { StrategyCard } from "./StrategyCard";
import { StrategyForm } from "./StrategyForm";

const STRATEGIES_URL = "/api/strategies";
const BOTS_URL = "/api/bots?includeDisabled=true";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function StrategiesManager() {
  const stratResp = useSWR<{ strategies: StrategyDefinition[] }>(
    STRATEGIES_URL,
    fetcher
  );
  const botsResp = useSWR<{ bots: Bot[] }>(BOTS_URL, fetcher);

  const strategies = stratResp.data?.strategies ?? [];
  const bots = botsResp.data?.bots ?? [];
  const loading = stratResp.isLoading || botsResp.isLoading;

  const [showForm, setShowForm] = useState(false);

  const usageBySlug = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const b of bots) {
      const list = map.get(b.strategySlug) ?? [];
      list.push(b.id);
      map.set(b.strategySlug, list);
    }
    return map;
  }, [bots]);

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Strategies</h1>
          <p className="text-xs text-[var(--color-muted)] mt-0.5 max-w-2xl">
            Each strategy has a markdown rule book (seeded into per-bot
            memory on first assignment) and a set of typed parameters that
            cloud routines will read at runtime as <code>STRATEGY_*</code>{" "}
            env vars. Bots reference a strategy by slug.
          </p>
        </div>
      </header>

      <Card
        title="Registry"
        subtitle={`${strategies.length} strateg${strategies.length === 1 ? "y" : "ies"} · ${bots.length} bot${bots.length === 1 ? "" : "s"} bound`}
        right={
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="glass rounded-full px-3 py-1.5 text-xs font-semibold hover:opacity-90"
          >
            + New strategy
          </button>
        }
      >
        {loading ? (
          <div className="text-xs text-[var(--color-muted)]">Loading…</div>
        ) : strategies.length === 0 ? (
          <EmptyRegistry onAdd={() => setShowForm(true)} />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {strategies.map((s) => (
              <StrategyCard
                key={s.slug}
                strategy={s}
                inUseBy={usageBySlug.get(s.slug) ?? []}
              />
            ))}
          </div>
        )}
      </Card>

      <Card
        title="How this fits together"
        subtitle="Read-only summary"
      >
        <ul className="text-xs text-[var(--color-muted)] space-y-1.5 leading-relaxed">
          <li>
            <span className="text-[var(--color-text)] font-medium">
              Phase 2 (now):
            </span>{" "}
            Create strategies here. Bots can already reference any slug from
            the existing bot form (Phase 3 swaps the input for a dropdown).
          </li>
          <li>
            <span className="text-[var(--color-text)] font-medium">
              Phase 4:
            </span>{" "}
            Routines read each param as a <code>STRATEGY_*</code> env var
            with safe defaults that match today&apos;s hard-coded values.
          </li>
          <li>
            <span className="text-[var(--color-text)] font-medium">
              Phase 5:
            </span>{" "}
            Edit / disable / delete from these cards. Bot cards will surface
            a &quot;strategy edited since assignment&quot; badge when{" "}
            <code>strategyVersionAtAssign</code> falls behind.
          </li>
          <li>
            Strategies live in <code>memory/shared/dashboard-settings.json</code>{" "}
            (gitignored). Per-bot rule books continue to live at{" "}
            <code>memory/&lt;bot&gt;/&lt;slug&gt;/TRADING-STRATEGY.md</code>.
          </li>
        </ul>
      </Card>

      {showForm && (
        <StrategyForm existing={strategies} onClose={() => setShowForm(false)} />
      )}
    </div>
  );
}

function EmptyRegistry({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="text-xs text-[var(--color-muted)] space-y-2">
      <p>
        No strategies registered yet. Run the bootstrap to seed the{" "}
        <code>default</code> entry from your live{" "}
        <code>TRADING-STRATEGY.md</code>:
      </p>
      <pre className="font-mono text-[10px] bg-[rgba(255,255,255,0.04)] p-2 rounded border border-[rgba(255,255,255,0.06)]">
        node dashboard/scripts/seed-default-strategy.mjs
      </pre>
      <p>or:</p>
      <button
        type="button"
        onClick={onAdd}
        className="glass rounded-full px-3 py-1.5 text-xs font-semibold glass-tint-accent"
      >
        + Create a strategy from scratch
      </button>
    </div>
  );
}
