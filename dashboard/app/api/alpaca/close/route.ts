import { NextResponse } from "next/server";
import { z } from "zod";
import { runAlpacaWrite } from "@/lib/alpaca";
import { appendAudit, checkRateLimit } from "@/lib/auditLog";
import { resolveOrderIdentity } from "@/lib/resolveAccount";
import { invalidateAccountCaches } from "@/lib/bots/perBotPositions";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const SYMBOL_RE = /^[A-Z]{1,5}$/;
const SLUG_RE = /^[a-z0-9][a-z0-9-]*$/;

const closeSchema = z
  .object({
    symbol: z.string().regex(SYMBOL_RE, "Symbol must be 1-5 uppercase letters"),
    accountId: z.string().regex(SLUG_RE).optional(),
    botId: z.string().regex(SLUG_RE).optional(),
    mode: z.enum(["paper", "live"]).optional(),
    confirmLive: z.string().optional(),
  })
  .refine((v) => v.accountId || v.mode, {
    message: "Body must include either `accountId` or `mode`",
  });

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }
  const parsed = closeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid close", details: parsed.error.issues },
      { status: 400 }
    );
  }
  const o = parsed.data;
  const id = await resolveOrderIdentity(o);
  if ("error" in id) return NextResponse.json({ error: id.error }, { status: id.status });

  if (id.effectiveMode === "live" && o.confirmLive !== "I-CONFIRM-LIVE") {
    return NextResponse.json(
      { error: "Live mode close requires confirmLive='I-CONFIRM-LIVE'" },
      { status: 403 }
    );
  }
  const rate = checkRateLimit(`close:${id.bucket}`);
  if (!rate.ok) {
    return NextResponse.json(
      { error: "rate limit exceeded", retryAfterMs: rate.retryAfterMs },
      { status: 429 }
    );
  }
  try {
    const result = await runAlpacaWrite("close", [o.symbol], id.opts);
    if (id.accountId) invalidateAccountCaches(id.accountId);
    await appendAudit({
      action: "close",
      mode: id.effectiveMode,
      accountId: id.accountId ?? undefined,
      botId: id.botId ?? undefined,
      symbol: o.symbol,
      ok: true,
    });
    return NextResponse.json({
      ok: true,
      mode: id.effectiveMode,
      accountId: id.accountId,
      botId: id.botId,
      result,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await appendAudit({
      action: "close",
      mode: id.effectiveMode,
      accountId: id.accountId ?? undefined,
      botId: id.botId ?? undefined,
      symbol: o.symbol,
      ok: false,
      error: msg,
    });
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
