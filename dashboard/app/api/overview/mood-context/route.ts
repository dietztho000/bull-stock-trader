import { NextResponse, type NextRequest } from "next/server";
import { loadBenchmark } from "@/lib/parsers/benchmark";
import { consecutiveWinningDays } from "@/lib/mascot/streak";
import { readBotParam, resolveBotCtx } from "@/lib/resolveAccount";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const RECENT_ROW_COUNT = 7;

export async function GET(req: NextRequest) {
  try {
    const { botId, strategy } = await resolveBotCtx({
      account: readBotParam(req.nextUrl.searchParams) ?? undefined,
    });
    const benchmark = await loadBenchmark({ bot: botId, strategy });
    const rows = benchmark.rows;
    const last = rows.length > 0 ? rows[rows.length - 1] : null;
    const recentRows = rows
      .slice(-RECENT_ROW_COUNT)
      .map((r) => ({ date: r.date, portfolio: r.portfolio }));
    const winStreak = consecutiveWinningDays(rows);
    const spyPhasePct = last?.spyPhasePct ?? null;
    return NextResponse.json(
      {
        winStreak,
        spyPhasePct,
        phaseStart: benchmark.phaseStart,
        startingEquity: benchmark.startingEquity,
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
