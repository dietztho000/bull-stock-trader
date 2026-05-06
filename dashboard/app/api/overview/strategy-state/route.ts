import { NextResponse, type NextRequest } from "next/server";
import { loadStrategyState } from "@/lib/strategyState";
import { readBotParam, resolveBotCtx } from "@/lib/resolveAccount";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Two-layer caching: this endpoint sets `Cache-Control: no-store` so
 *  browsers/intermediaries never cache the response, but the underlying
 *  `loadStrategyState` keeps a 25s in-memory cache keyed by botId
 *  (invalidated by the chokidar watcher on any per-bot/shared write —
 *  see lib/strategyState.ts). The combination is intentional: clients
 *  always see fresh data after a write, but parallel renders within the
 *  25s window share one fan-out instead of re-fetching positions, sector
 *  ledger, and earnings calendar each time. */
export async function GET(req: NextRequest) {
  try {
    const { botId, strategy } = await resolveBotCtx({
      bot: readBotParam(req.nextUrl.searchParams) ?? undefined,
    });
    const state = await loadStrategyState({ bot: botId, strategy });
    return NextResponse.json(state, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
