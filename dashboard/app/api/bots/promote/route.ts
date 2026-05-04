import { NextResponse } from "next/server";
import { z } from "zod";
import {
  applyPromotion,
  diffStrategy,
  resolvePromoteCtx,
} from "@/lib/promote";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const SLUG_RE = /^[a-z0-9][a-z0-9-]*$/;
const slug = z.string().regex(SLUG_RE);

const previewBody = z.object({
  sourceBotId: slug,
  targetBotId: slug,
  dryRun: z.literal(true),
});

const applyBody = z.object({
  sourceBotId: slug,
  targetBotId: slug,
  /** Cheap-but-effective guard against accidental promotion. The UI
   *  surfaces this in the confirm modal so the user has to type it. */
  confirm: z.literal("I-CONFIRM-PROMOTE"),
});

const body = z.union([previewBody, applyBody]);

export async function POST(req: Request) {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }
  const parsed = body.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid promote request", details: parsed.error.issues },
      { status: 400 }
    );
  }
  const ctxOrErr = await resolvePromoteCtx(
    parsed.data.sourceBotId,
    parsed.data.targetBotId
  );
  if ("error" in ctxOrErr) {
    return NextResponse.json({ error: ctxOrErr.error }, { status: ctxOrErr.status });
  }
  const ctx = ctxOrErr;

  const diff = await diffStrategy(ctx);

  if ("dryRun" in parsed.data) {
    return NextResponse.json({
      source: ctx.source,
      target: ctx.target,
      diff,
    });
  }

  const result = await applyPromotion(ctx, diff);
  return NextResponse.json({
    source: ctx.source,
    target: ctx.target,
    diff,
    ...result,
  });
}
