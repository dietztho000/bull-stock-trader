import { NextRequest } from "next/server";
import { getPostMortem } from "@/lib/ai/postMortem";
import { readBotParam, resolveBotCtx } from "@/lib/resolveAccount";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  let body: { symbol?: string; entryDate?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "invalid json" }, { status: 400 });
  }
  const { botId, strategy } = await resolveBotCtx({
    account: readBotParam(req.nextUrl.searchParams) ?? undefined,
  });
  const result = await getPostMortem(
    body.symbol ?? "",
    body.entryDate ?? null,
    { bot: botId, strategy }
  );
  if (!result.ok) {
    return Response.json({ error: result.error }, { status: result.status });
  }
  return Response.json({
    text: result.text,
    generatedAt: result.generatedAt,
    cacheHit: result.cacheHit,
  });
}
