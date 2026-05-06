"use client";

import useSWR from "swr";
import Link from "next/link";
import { Card, Kpi } from "@/components/ui/Card";
import { fmtMoney, fmtPct, fmtSignedMoney, colorOf } from "@/lib/format";
import { useLiveSwr } from "@/lib/useLiveSwr";
import type { LeaderboardRow } from "@/app/api/bots/leaderboard/route";

const fetcher = (u: string) => fetch(u).then((r) => r.json());

/** Audit NF2 — fleet-level aggregate so the dashboard reads the headline
 *  "test multiple strategies in parallel" pitch end-to-end. Same source
 *  (/api/bots/leaderboard) the per-bot leaderboard renders, just rolled
 *  up. Hides itself for single-bot installs since the existing PnlHero
 *  already covers that case. */
export function FleetSummaryTile() {
  const liveOpts = useLiveSwr(60_000);
  const { data, error, isLoading } = useSWR<{ rows: LeaderboardRow[] }>(
    "/api/bots/leaderboard",
    fetcher,
    { ...liveOpts, keepPreviousData: true }
  );

  if (isLoading && !data) {
    return (
      <Card title="Fleet" subtitle="Loading…">
        <div className="text-xs text-[var(--color-muted)]">
          Aggregating across enabled bots…
        </div>
      </Card>
    );
  }
  if (error) {
    return (
      <Card title="Fleet">
        <div className="text-xs text-[var(--color-down)]">
          Failed to load: {error instanceof Error ? error.message : String(error)}
        </div>
      </Card>
    );
  }

  const rows = (data?.rows ?? []).filter((r) => r.enabled);
  // Single-bot installs already see this surface in PnlHero — skip the
  // duplicate KPIs and keep the Overview compact.
  if (rows.length < 2) return null;

  const equityRows = rows.filter((r) => r.equity != null);
  const totalEquity = equityRows.reduce((s, r) => s + (r.equity ?? 0), 0);
  const totalUnreal = equityRows.reduce((s, r) => s + (r.unrealizedPl ?? 0), 0);

  // Day P&L in $ requires last_equity per bot — leaderboard exposes dayPct on
  // each row but not the dollar value. Approximate by applying each bot's
  // dayPct to its equity; this matches what the user saw on the per-bot card.
  const dayPnl = equityRows.reduce((s, r) => {
    if (r.dayPct == null || r.equity == null) return s;
    const lastEq = r.equity / (1 + r.dayPct / 100);
    return s + (r.equity - lastEq);
  }, 0);
  const dayPct =
    totalEquity > 0 && dayPnl !== 0
      ? (dayPnl / (totalEquity - dayPnl)) * 100
      : 0;

  // Phase alpha (already daily-anchored to phaseStart in BENCHMARK).
  // Equal-weight across bots that have the metric — simpler than capital-
  // weighting and avoids penalizing a small allocation that's beating SPY.
  const alphaRows = rows.filter((r) => r.phaseAlphaPct != null);
  const avgAlpha =
    alphaRows.length > 0
      ? alphaRows.reduce((s, r) => s + (r.phaseAlphaPct ?? 0), 0) /
        alphaRows.length
      : null;

  // Count + best/worst day performers.
  let green = 0;
  let red = 0;
  let flat = 0;
  let best: LeaderboardRow | null = null;
  let worst: LeaderboardRow | null = null;
  for (const r of rows) {
    if (r.dayPct == null) {
      flat++;
      continue;
    }
    if (r.dayPct > 0.1) green++;
    else if (r.dayPct < -0.1) red++;
    else flat++;
    if (best == null || (r.dayPct ?? 0) > (best.dayPct ?? 0)) best = r;
    if (worst == null || (r.dayPct ?? 0) < (worst.dayPct ?? 0)) worst = r;
  }

  return (
    <Card
      title="Fleet"
      subtitle={`${rows.length} enabled bot${rows.length === 1 ? "" : "s"} · refresh 60s`}
      right={
        <Link
          href="/bots/compare"
          className="text-[11px] text-[var(--color-accent)] hover:underline"
        >
          Side-by-side →
        </Link>
      }
    >
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Kpi
          label="Total equity"
          value={fmtMoney(totalEquity)}
          hint={
            totalUnreal !== 0
              ? `${fmtSignedMoney(totalUnreal)} unreal`
              : undefined
          }
        />
        <Kpi
          label="Day P&L"
          value={fmtSignedMoney(dayPnl)}
          delta={{ value: fmtPct(dayPct), positive: colorOf(dayPnl) }}
          hint={`${green} green · ${red} red · ${flat} flat`}
        />
        <Kpi
          label="Avg alpha vs SPY"
          value={avgAlpha != null ? fmtPct(avgAlpha) : "—"}
          hint={`phase to date · ${alphaRows.length}/${rows.length} bots`}
        />
        <Kpi
          label="Today's range"
          value={
            best && worst && best.dayPct != null && worst.dayPct != null
              ? `${fmtPct(worst.dayPct)} → ${fmtPct(best.dayPct)}`
              : "—"
          }
          hint={
            best && worst && best.botId !== worst.botId
              ? `${worst.name} · ${best.name}`
              : undefined
          }
        />
      </div>
    </Card>
  );
}
