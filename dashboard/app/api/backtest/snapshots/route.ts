import { NextResponse } from "next/server";
import { listBacktestSnapshots } from "@/lib/backtest/cache";
import { readBotParam, resolveBotCtx } from "@/lib/resolveAccount";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Audit F4 — lists every retained backtest snapshot for the active bot.
 *  Response holds metadata only (no per-trade results) so the picker UI
 *  can render the list without pulling 100s of KB of trade data. */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const account = readBotParam(url.searchParams) ?? undefined;
    const { botId, strategy } = await resolveBotCtx({ account });
    const snapshots = await listBacktestSnapshots({ bot: botId, strategy });
    return NextResponse.json(
      { botId, strategy, snapshots },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
