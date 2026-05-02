import { NextRequest } from "next/server";
import { getPostMortem } from "@/lib/ai/postMortem";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  let body: { symbol?: string; entryDate?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "invalid json" }, { status: 400 });
  }
  const result = await getPostMortem(body.symbol ?? "", body.entryDate ?? null);
  if (!result.ok) {
    return Response.json({ error: result.error }, { status: result.status });
  }
  return Response.json({
    text: result.text,
    generatedAt: result.generatedAt,
    cacheHit: result.cacheHit,
  });
}
