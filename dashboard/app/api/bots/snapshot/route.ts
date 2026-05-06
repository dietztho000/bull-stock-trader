import { NextResponse, type NextRequest } from "next/server";
import { listBots } from "@/lib/settings";
import { loadBenchmark } from "@/lib/parsers/benchmark";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export type SnapshotRow = {
  botId: string;
  enabled: boolean;
  dayPct: number | null;
};

/** Slim cross-bot fanout for the mascot's `MultiBotMoodLine` (audit NU4).
 *  Returns just the day-pct per enabled bot — no Alpaca shells, no
 *  drawdown/ledger compute — so the Overview page doesn't pay the full
 *  leaderboard price every time the mascot tile mounts. The leaderboard
 *  endpoint stays the source of truth for the /bots page where the
 *  heavier columns are visible. */
export async function GET(req: NextRequest) {
  try {
    const includeDisabled =
      req.nextUrl.searchParams.get("includeDisabled") === "true";
    const allBots = await listBots();
    const bots = includeDisabled ? allBots : allBots.filter((b) => b.enabled);
    const rows = await Promise.all(
      bots.map(async (b): Promise<SnapshotRow> => {
        const benchmark = await loadBenchmark({
          bot: b.id,
          strategy: b.strategySlug,
        }).catch(() => null);
        const lastRow =
          benchmark && benchmark.rows.length > 0
            ? benchmark.rows[benchmark.rows.length - 1]
            : null;
        return {
          botId: b.id,
          enabled: b.enabled,
          dayPct: lastRow?.dayPct ?? null,
        };
      })
    );
    return NextResponse.json(
      { rows },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
