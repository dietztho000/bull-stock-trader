import { NextResponse } from "next/server";
import { z } from "zod";
import { addStrategy, listStrategies } from "@/lib/settings";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const slugSchema = z
  .string()
  .min(1)
  .max(40)
  .regex(/^[a-z0-9][a-z0-9-]*$/, "Use lowercase letters, digits, and hyphens");

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

const createBody = z.object({
  slug: slugSchema,
  name: z.string().min(1).max(60),
  description: z.string().max(500).default(""),
  enabled: z.boolean().default(true),
  ruleBookTemplate: z.string().default(""),
  params: z.array(paramSchema).default([]),
});

export async function GET() {
  try {
    const strategies = await listStrategies();
    return NextResponse.json(
      { strategies },
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
    await addStrategy(body);
    const strategies = await listStrategies();
    const created = strategies.find((s) => s.slug === body.slug);
    return NextResponse.json(
      { strategy: created, strategies },
      { status: 201, headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 400 }
    );
  }
}
