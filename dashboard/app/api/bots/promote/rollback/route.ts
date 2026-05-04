import { NextResponse } from "next/server";
import { z } from "zod";
import { getRollbackCandidate, rollbackLastPromotion } from "@/lib/promote";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const SLUG_RE = /^[a-z0-9][a-z0-9-]*$/;

/** GET /api/bots/promote/rollback?targetBotId=<slug>
 *
 *  Read-only preview: returns the most recent un-rolled-back promote
 *  entry for the target, including a snippet of the prior strategy
 *  content so the UI can confirm "revert to <N> chars from <date>".
 *  Returns { candidate: null } when nothing is available to roll back. */
export async function GET(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const targetBotId = url.searchParams.get("targetBotId") ?? "";
  if (!SLUG_RE.test(targetBotId)) {
    return NextResponse.json(
      { error: "targetBotId query param required" },
      { status: 400 }
    );
  }
  const candidate = await getRollbackCandidate(targetBotId);
  if (!candidate) {
    return NextResponse.json({ candidate: null });
  }
  // Don't ship the full prior content over the wire on the GET path —
  // a strategy file can be many KB. The apply path (POST) reads it
  // directly from PROMOTION-LOG. Surface a length + 200-char preview.
  return NextResponse.json({
    candidate: {
      sourceBotId: candidate.sourceBotId,
      targetBotId: candidate.targetBotId,
      ts: candidate.ts,
      added: candidate.added,
      removed: candidate.removed,
      priorContentBytes: candidate.priorTargetContent.length,
      priorContentPreview: candidate.priorTargetContent.slice(0, 200),
    },
  });
}

const applyBody = z.object({
  targetBotId: z.string().regex(SLUG_RE),
  /** Cheap-but-effective guard against accidental rollback. UI surfaces
   *  this in the confirm modal so the user has to type it. */
  confirm: z.literal("I-CONFIRM-ROLLBACK"),
});

/** POST /api/bots/promote/rollback
 *
 *  Reverts the target's TRADING-STRATEGY.md to the content captured in
 *  the most recent un-rolled-back promote entry. Idempotent: a second
 *  rollback with the same input is a no-op (returns 404 because the
 *  prior promote has already been consumed). */
export async function POST(req: Request): Promise<Response> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }
  const parsed = applyBody.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid rollback request", details: parsed.error.issues },
      { status: 400 }
    );
  }
  const result = await rollbackLastPromotion(parsed.data.targetBotId);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json({
    targetBotId: parsed.data.targetBotId,
    revertedFrom: result.revertedFrom,
    revertedPromoteTs: result.revertedPromoteTs,
  });
}
