import { NextResponse } from "next/server";
import { z } from "zod";
import { rekeyAllAccounts } from "@/lib/vaultRekey";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const bodySchema = z.object({
  newKey: z.string().min(40, "Key looks too short to be base64-encoded 32 bytes"),
});

/** Audit F6 — re-encrypt every stored account credential under a new master
 *  key. The currently-running process retains the OLD key in env until
 *  restart, so the response makes the post-rotation steps explicit:
 *    1. Update `BULL_VAULT_KEY` in the dashboard's .env.
 *    2. Restart the dashboard process (and any cloud routines that share .env).
 *  Until then, every credential read fails — the response says so plainly. */
export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues.map((i) => i.message).join("; ") },
      { status: 400 }
    );
  }
  try {
    const report = await rekeyAllAccounts(parsed.data.newKey);
    return NextResponse.json({
      ok: true,
      reencrypted: report.reencrypted,
      skipped: report.skipped,
      backupPath: report.backupPath,
      nextSteps: [
        `Update BULL_VAULT_KEY in your dashboard .env (and any shared cloud-routine config).`,
        `Restart the dashboard. Until you do, credential-bound operations (orders, equity, healthcheck) will fail.`,
      ],
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
