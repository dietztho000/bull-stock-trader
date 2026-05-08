import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { deleteStrategy, getStrategy, listStrategies, updateStrategy } from "@/lib/settings";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const paramKeySchema = z
  .string()
  .min(1)
  .max(40)
  .regex(/^[A-Z][A-Z0-9_]*$/, "Use SCREAMING_SNAKE_CASE");

const paramSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("number"),
    key: paramKeySchema,
    label: z.string().min(1).max(60),
    value: z.number(),
    min: z.number().optional(),
    max: z.number().optional(),
    step: z.number().positive().optional(),
    unit: z.string().max(8).optional(),
  }),
  z.object({
    kind: z.literal("percent"),
    key: paramKeySchema,
    label: z.string().min(1).max(60),
    value: z.number(),
    min: z.number(),
    max: z.number(),
  }),
  z.object({
    kind: z.literal("enum"),
    key: paramKeySchema,
    label: z.string().min(1).max(60),
    value: z.string().min(1),
    options: z.array(z.string().min(1)).min(2).max(20),
  }),
  z.object({
    kind: z.literal("table"),
    key: paramKeySchema,
    label: z.string().min(1).max(60),
    rows: z
      .array(
        z.object({
          k: z.union([z.string(), z.number()]),
          v: z.union([z.string(), z.number()]),
        })
      )
      .min(1)
      .max(50),
  }),
]);

const patchBody = z.object({
  name: z.string().min(1).max(60).optional(),
  description: z.string().max(500).optional(),
  enabled: z.boolean().optional(),
  ruleBookTemplate: z.string().optional(),
  params: z.array(paramSchema).optional(),
});

export async function GET(
  _req: Request,
  context: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await context.params;
    const strategy = await getStrategy(slug);
    if (!strategy) {
      return NextResponse.json(
        { error: `Strategy "${slug}" not found` },
        { status: 404 }
      );
    }
    return NextResponse.json(
      { strategy },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: Request,
  context: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await context.params;
    const body = patchBody.parse(await req.json());
    await updateStrategy(slug, body);
    const strategy = await getStrategy(slug);
    return NextResponse.json(
      { strategy, strategies: await listStrategies() },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: err instanceof Error && /not found/i.test(err.message) ? 404 : 400 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await context.params;
    const force = req.nextUrl.searchParams.get("force") === "true";
    await deleteStrategy(slug, { force });
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    let status = 400;
    if (/not found/i.test(message)) status = 404;
    else if (/still reference/i.test(message)) status = 409;
    return NextResponse.json({ error: message }, { status });
  }
}
