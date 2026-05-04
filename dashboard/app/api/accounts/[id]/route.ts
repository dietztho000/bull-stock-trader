import { NextResponse } from "next/server";
import { z } from "zod";
import { deleteAccount, redactAccount, updateAccount } from "@/lib/settings";
import { encryptCredential } from "@/lib/accountVault";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** PATCH body — every field optional. New `apiKey` / `secretKey` are
 *  ENCRYPTED here before persisting; the client never sees ciphertext.
 *  Used by the click-to-fix HealthDot flow (follow-up #3) so a user
 *  with revoked Alpaca keys can rotate without deleting + recreating. */
const patchBody = z.object({
  label: z.string().min(1).max(60).optional(),
  endpoint: z.string().url().optional(),
  totalCapital: z.number().positive().nullable().optional(),
  apiKey: z.string().min(1).optional(),
  secretKey: z.string().min(1).optional(),
  hardCapAllocation: z.boolean().optional(),
});

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await ctx.params;
    const body = patchBody.parse(await req.json());
    const patch: {
      label?: string;
      endpoint?: string;
      totalCapital?: number;
      apiKeyEnc?: string;
      secretKeyEnc?: string;
      hardCapAllocation?: boolean;
    } = {};
    if (body.label !== undefined) patch.label = body.label;
    if (body.endpoint !== undefined) patch.endpoint = body.endpoint;
    if (body.totalCapital !== undefined && body.totalCapital !== null) {
      patch.totalCapital = body.totalCapital;
    }
    if (body.apiKey !== undefined) patch.apiKeyEnc = encryptCredential(body.apiKey);
    if (body.secretKey !== undefined) patch.secretKeyEnc = encryptCredential(body.secretKey);
    if (body.hardCapAllocation !== undefined) patch.hardCapAllocation = body.hardCapAllocation;
    const next = await updateAccount(id, patch);
    const account = next.accounts.find((a) => a.id === id);
    return NextResponse.json(
      { account: account ? redactAccount(account) : null },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 400 }
    );
  }
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await ctx.params;
    await deleteAccount(id);
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // FK violation → 409 Conflict (caller should delete bots first)
    const status = msg.includes("bots still bound") ? 409 : 400;
    return NextResponse.json({ error: msg }, { status });
  }
}
