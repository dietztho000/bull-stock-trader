import { NextResponse } from "next/server";
import { z } from "zod";
import { addBot, listBots } from "@/lib/settings";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const slugSchema = z
  .string()
  .min(1)
  .max(40)
  .regex(/^[a-z0-9][a-z0-9-]*$/, "Use lowercase letters, digits, and hyphens");

const createBody = z.object({
  id: slugSchema,
  name: z.string().min(1).max(60),
  accountId: slugSchema,
  allocation: z.number().positive().nullable(),
  strategySlug: z.string().min(1).max(40).default("default"),
  enabled: z.boolean().default(true),
});

export async function GET() {
  try {
    const bots = await listBots();
    return NextResponse.json(
      { bots },
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
    await addBot({
      id: body.id,
      name: body.name,
      accountId: body.accountId,
      allocation: body.allocation,
      strategySlug: body.strategySlug,
      enabled: body.enabled,
      createdAt: new Date().toISOString(),
    });
    const bots = await listBots();
    return NextResponse.json(
      { bots },
      { status: 201, headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 400 }
    );
  }
}
