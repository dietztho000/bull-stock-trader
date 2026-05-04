import { NextResponse } from "next/server";
import { z } from "zod";
import { runAlpacaWrite, type AlpacaMode } from "@/lib/alpaca";
import { appendAudit, checkRateLimit } from "@/lib/auditLog";
import { resolveOrderIdentity } from "@/lib/resolveAccount";
import { invalidateAccountCaches } from "@/lib/bots/perBotPositions";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const modeSchema = z.enum(["paper", "live"]);
const sideSchema = z.enum(["buy", "sell"]);
const orderTypeSchema = z.enum(["market", "limit", "stop", "stop_limit", "trailing_stop"]);
const tifSchema = z.enum(["day", "gtc"]);

const SYMBOL_RE = /^[A-Z]{1,5}$/;
const SLUG_RE = /^[a-z0-9][a-z0-9-]*$/;

/** Identity is one of:
 *  - `accountId` (+ optional `botId`) — multi-bot path; routes through the
 *    encrypted vault and tags client_order_id with the bot prefix.
 *  - `mode` — legacy `live`|`paper` path; uses .env credentials directly.
 *  At least one of `accountId` or `mode` must be set. When both are set,
 *  `accountId` wins. */
const identitySchema = z
  .object({
    accountId: z.string().regex(SLUG_RE).optional(),
    botId: z.string().regex(SLUG_RE).optional(),
    mode: modeSchema.optional(),
  })
  .refine((v) => v.accountId || v.mode, {
    message: "Body must include either `accountId` or `mode`",
  });

const submitOrderSchema = identitySchema.and(
  z.object({
    symbol: z.string().regex(SYMBOL_RE, "Symbol must be 1-5 uppercase letters"),
    qty: z.number().int().positive().max(100_000),
    side: sideSchema,
    type: orderTypeSchema.default("market"),
    tif: tifSchema.default("day"),
    limitPrice: z.number().positive().optional(),
    stopPrice: z.number().positive().optional(),
    trailPercent: z.number().positive().max(50).optional(),
    /** Required for live mode — must equal "I-CONFIRM-LIVE". Cheap-but-
     *  effective guard against accidental live submission via a stale tab. */
    confirmLive: z.string().optional(),
  })
);

const replaceOrderSchema = identitySchema.and(
  z.object({
    orderId: z.string().min(8).max(64),
    qty: z.number().int().positive().optional(),
    limitPrice: z.number().positive().optional(),
    stopPrice: z.number().positive().optional(),
    trailPercent: z.number().positive().max(50).optional(),
    tif: tifSchema.optional(),
    confirmLive: z.string().optional(),
  })
);

function ensureLiveConfirmation(mode: AlpacaMode, confirm?: string) {
  if (mode === "live" && confirm !== "I-CONFIRM-LIVE") {
    return "Live mode requires explicit confirmLive='I-CONFIRM-LIVE' in request body.";
  }
  return null;
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }
  const parsed = submitOrderSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid order", details: parsed.error.issues },
      { status: 400 }
    );
  }
  const o = parsed.data;
  const id = await resolveOrderIdentity(o);
  if ("error" in id) return NextResponse.json({ error: id.error }, { status: id.status });

  const guard = ensureLiveConfirmation(id.effectiveMode, o.confirmLive);
  if (guard) return NextResponse.json({ error: guard }, { status: 403 });
  const rate = checkRateLimit(`order:${id.bucket}`);
  if (!rate.ok) {
    return NextResponse.json(
      { error: "rate limit exceeded", retryAfterMs: rate.retryAfterMs },
      { status: 429 }
    );
  }

  const args: string[] = [
    "--symbol", o.symbol,
    "--qty", String(o.qty),
    "--side", o.side,
    "--type", o.type,
    "--tif", o.tif,
  ];
  if (o.limitPrice != null) args.push("--limit-price", String(o.limitPrice));
  if (o.stopPrice != null) args.push("--stop-price", String(o.stopPrice));
  if (o.trailPercent != null) args.push("--trail-percent", String(o.trailPercent));

  try {
    const result = await runAlpacaWrite("submit-order", args, id.opts);
    if (id.accountId) invalidateAccountCaches(id.accountId);
    await appendAudit({
      action: "submit-order",
      mode: id.effectiveMode,
      accountId: id.accountId ?? undefined,
      botId: id.botId ?? undefined,
      symbol: o.symbol,
      detail: { qty: o.qty, side: o.side, type: o.type, tif: o.tif },
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
      action: "submit-order",
      mode: id.effectiveMode,
      accountId: id.accountId ?? undefined,
      botId: id.botId ?? undefined,
      symbol: o.symbol,
      detail: { qty: o.qty, side: o.side, type: o.type, tif: o.tif },
      ok: false,
      error: msg,
    });
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }
  const parsed = replaceOrderSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid replace", details: parsed.error.issues },
      { status: 400 }
    );
  }
  const o = parsed.data;
  const id = await resolveOrderIdentity(o);
  if ("error" in id) return NextResponse.json({ error: id.error }, { status: id.status });

  const guard = ensureLiveConfirmation(id.effectiveMode, o.confirmLive);
  if (guard) return NextResponse.json({ error: guard }, { status: 403 });
  const rate = checkRateLimit(`order:${id.bucket}`);
  if (!rate.ok) {
    return NextResponse.json(
      { error: "rate limit exceeded", retryAfterMs: rate.retryAfterMs },
      { status: 429 }
    );
  }

  const args: string[] = [o.orderId];
  if (o.qty != null) args.push("--qty", String(o.qty));
  if (o.limitPrice != null) args.push("--limit-price", String(o.limitPrice));
  if (o.stopPrice != null) args.push("--stop-price", String(o.stopPrice));
  if (o.trailPercent != null) args.push("--trail-percent", String(o.trailPercent));
  if (o.tif != null) args.push("--tif", o.tif);

  try {
    const result = await runAlpacaWrite("replace-order", args, id.opts);
    if (id.accountId) invalidateAccountCaches(id.accountId);
    await appendAudit({
      action: "replace-order",
      mode: id.effectiveMode,
      accountId: id.accountId ?? undefined,
      botId: id.botId ?? undefined,
      detail: {
        orderId: o.orderId,
        qty: o.qty,
        limitPrice: o.limitPrice,
        stopPrice: o.stopPrice,
        trailPercent: o.trailPercent,
        tif: o.tif,
      },
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
      action: "replace-order",
      mode: id.effectiveMode,
      accountId: id.accountId ?? undefined,
      botId: id.botId ?? undefined,
      detail: { orderId: o.orderId },
      ok: false,
      error: msg,
    });
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
