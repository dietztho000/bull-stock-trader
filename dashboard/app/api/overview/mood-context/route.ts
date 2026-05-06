import { NextResponse, type NextRequest } from "next/server";
import { loadBenchmark } from "@/lib/parsers/benchmark";
import { consecutiveWinningDays } from "@/lib/mascot/streak";
import { readBotParam, resolveBotCtx } from "@/lib/resolveAccount";
import { currentWeekMondayCT } from "@/lib/time";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const RECENT_ROW_COUNT = 7;

/** First portfolio value on or after this week's Monday (CT). Mirrors the
 *  resolver in app/page.tsx so the mascot's week-breaker detection sees the
 *  same week-start as the P&L hero. */
function resolveWeekStartPortfolio(
  rows: { date: string; portfolio: number | null }[]
): number | null {
  const mondayStr = currentWeekMondayCT();
  for (const r of rows) {
    if (r.date >= mondayStr && r.portfolio != null) return r.portfolio;
  }
  for (let i = rows.length - 1; i >= 0; i--) {
    if (rows[i].portfolio != null) return rows[i].portfolio;
  }
  return null;
}

export async function GET(req: NextRequest) {
  try {
    const { botId, strategy } = await resolveBotCtx({
      bot: readBotParam(req.nextUrl.searchParams) ?? undefined,
    });
    const benchmark = await loadBenchmark({ bot: botId, strategy });
    const rows = benchmark.rows;
    const last = rows.length > 0 ? rows[rows.length - 1] : null;
    const recentRows = rows
      .slice(-RECENT_ROW_COUNT)
      .map((r) => ({ date: r.date, portfolio: r.portfolio }));
    const winStreak = consecutiveWinningDays(rows);
    const spyPhasePct = last?.spyPhasePct ?? null;
    const weekStartPortfolio = resolveWeekStartPortfolio(rows);
    return NextResponse.json(
      {
        winStreak,
        spyPhasePct,
        phaseStart: benchmark.phaseStart,
        startingEquity: benchmark.startingEquity,
        weekStartPortfolio,
        recentRows,
      },
      {
        headers: { "Cache-Control": "no-store" },
      }
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
