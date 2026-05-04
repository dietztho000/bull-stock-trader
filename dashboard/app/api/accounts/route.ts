import { NextResponse } from "next/server";
import { z } from "zod";
import { addAccount, listAccounts, redactAccount } from "@/lib/settings";
import { encryptCredential } from "@/lib/accountVault";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const slugSchema = z
  .string()
  .min(1)
  .max(40)
  .regex(/^[a-z0-9][a-z0-9-]*$/, "Use lowercase letters, digits, and hyphens");

const createBody = z.object({
  id: slugSchema,
  label: z.string().min(1).max(60),
  mode: z.enum(["live", "paper"]),
  endpoint: z.string().url(),
  apiKey: z.string().min(1),
  secretKey: z.string().min(1),
  totalCapital: z.number().positive().optional(),
});

export async function GET() {
  try {
    const accounts = await listAccounts();
    return NextResponse.json(
      { accounts: accounts.map(redactAccount) },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = createBody.parse(await req.json());
    await addAccount({
      id: body.id,
      label: body.label,
      mode: body.mode,
      endpoint: body.endpoint,
      apiKeyEnc: encryptCredential(body.apiKey),
      secretKeyEnc: encryptCredential(body.secretKey),
      totalCapital: body.totalCapital,
      createdAt: new Date().toISOString(),
    });
    const accounts = await listAccounts();
    return NextResponse.json(
      { accounts: accounts.map(redactAccount) },
      { status: 201, headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 400 }
    );
  }
}
