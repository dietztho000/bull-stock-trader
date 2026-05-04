import { NextResponse } from "next/server";
import { readBacktestSnapshotById } from "@/lib/backtest/cache";
import { readBotParam, resolveBotCtx } from "@/lib/resolveAccount";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Audit F4 — fetches a single retained backtest snapshot by id. The
 *  active bot context is sourced from the URL `?bot=` param so the same
 *  snapshot id can be served from different bots' memory dirs. */
export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const url = new URL(req.url);
    const account = readBotParam(url.searchParams) ?? undefined;
    const { botId, strategy } = await resolveBotCtx({ account });
    const { id } = await ctx.params;
    const snapshot = await readBacktestSnapshotById(
      { bot: botId, strategy },
      id
    );
    if (!snapshot) {
      return NextResponse.json(
        { error: `snapshot "${id}" not found for bot ${botId}` },
        { status: 404 }
      );
    }
    return NextResponse.json(
      { botId, strategy, id, snapshot },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
