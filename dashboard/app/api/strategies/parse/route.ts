import { NextResponse } from "next/server";
import { z } from "zod";
import { parseStrategyPrompt } from "@/lib/ai/strategyParser";
import { listStrategies } from "@/lib/settings";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const bodySchema = z.object({
  prompt: z.string().min(1).max(8000),
});

export async function POST(req: Request) {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const body = bodySchema.safeParse(json);
  if (!body.success) {
    return NextResponse.json(
      { error: body.error.issues.map((i) => i.message).join("; ") },
      { status: 400 }
    );
  }

  let existingSlugs: string[] = [];
  try {
    const list = await listStrategies();
    existingSlugs = list.map((s) => s.slug);
  } catch {
    // Non-fatal — the LLM just won't get the existing-slug hint.
  }

  const result = await parseStrategyPrompt(body.data.prompt, { existingSlugs });
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, raw: result.raw },
      { status: 422 }
    );
  }

  return NextResponse.json(
    { strategy: result.strategy },
    { headers: { "Cache-Control": "no-store" } }
  );
}
