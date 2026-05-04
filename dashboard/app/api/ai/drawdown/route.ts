import type { NextRequest } from "next/server";
import { getDrawdownNarrative } from "@/lib/ai/drawdown";
import { readBotParam, resolveBotCtx } from "@/lib/resolveAccount";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const { botId, strategy } = await resolveBotCtx({
    account: readBotParam(req.nextUrl.searchParams) ?? undefined,
  });
  const result = await getDrawdownNarrative({ bot: botId, strategy });
  if ("error" in result) {
    return Response.json(result, { status: 500 });
  }
  return Response.json(result);
}
