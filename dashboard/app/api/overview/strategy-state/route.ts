import { NextResponse, type NextRequest } from "next/server";
import { loadStrategyState } from "@/lib/strategyState";
import { readBotParam, resolveBotCtx } from "@/lib/resolveAccount";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

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
