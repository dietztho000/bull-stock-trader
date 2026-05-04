import { NextResponse } from "next/server";
import { z } from "zod";
import { deleteBot, listBots, updateBot } from "@/lib/settings";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const webhookUrl = z
  .string()
  .url()
  .refine(
    (v) =>
      v.startsWith("https://discord.com/api/webhooks/") ||
      v.startsWith("https://discordapp.com/api/webhooks/"),
    "Discord webhook URLs must start with https://discord.com/api/webhooks/"
  );

const patchBody = z.object({
  name: z.string().min(1).max(60).optional(),
  accountId: z.string().min(1).max(40).optional(),
  allocation: z.number().positive().nullable().optional(),
  strategySlug: z.string().min(1).max(40).optional(),
  enabled: z.boolean().optional(),
  discordWebhookUrl: z
    .union([webhookUrl, z.literal(""), z.null()])
    .optional(),
  sentinel: z
    .object({
      enabled: z.boolean(),
      consecutiveLossesCap: z.number().int().min(2).max(20),
    })
    .nullable()
    .optional(),
});

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await ctx.params;
    const body = patchBody.parse(await req.json());
    // Empty-string webhook = clear; null = also clear; undefined = unchanged.
    const normalized = {
      ...body,
      discordWebhookUrl:
        body.discordWebhookUrl === ""
          ? null
          : body.discordWebhookUrl,
    };
    await updateBot(id, normalized);
    const bots = await listBots();
    return NextResponse.json(
      { bot: bots.find((b) => b.id === id) ?? null },
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
    await deleteBot(id);
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 400 }
    );
  }
}
