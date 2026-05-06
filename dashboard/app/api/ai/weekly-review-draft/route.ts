import { NextRequest } from "next/server";
import { getWeeklyReviewDraft } from "@/lib/ai/weeklyReview";
import { readBotParam, resolveBotCtx } from "@/lib/resolveAccount";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Audit F10 — generate a Friday weekly-review draft from the active bot's
 *  TRADE-LOG / SECTOR-LEDGER / BENCHMARK for the current trading week.
 *  Cached per (bot, week-ending) so repeated clicks within the hour reuse
 *  the prior draft. */
export async function POST(req: NextRequest) {
  const { botId, strategy } = await resolveBotCtx({
    bot: readBotParam(req.nextUrl.searchParams) ?? undefined,
  });
  const result = await getWeeklyReviewDraft({ bot: botId, strategy });
  if (!result.ok) {
    return Response.json({ error: result.error }, { status: result.status });
  }
  return Response.json(
    {
      draft: result.draft,
      weekEnding: result.weekEnding,
      generatedAt: result.generatedAt,
      cacheHit: result.cacheHit,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
