import { NextResponse } from "next/server";
import { z } from "zod";
import { runBacktest } from "@/lib/backtest/runner";
import { writeBacktestResults } from "@/lib/backtest/output";
import { writeBacktestSnapshot } from "@/lib/backtest/cache";
import { readBotParam, resolveBotCtx } from "@/lib/resolveAccount";
import { listBots } from "@/lib/settings";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const SLUG_RE = /^[a-z0-9][a-z0-9-]*$/;

/** Cross-bot backtest body (audit F8). All fields optional — empty body
 *  preserves the legacy "replay this bot's trades against built-in rules"
 *  behavior. `params` overrides specific exit-rule constants without
 *  forking the engine. `strategyBot` is provenance only — it doesn't
 *  resolve params on its own (settings.strategy is global today), but
 *  recording it lets us attribute "promoted from <strategyBot>" in the
 *  snapshot when a UI eventually pulls per-bot rule files. */
const bodySchema = z
  .object({
    params: z
      .object({
        stopTriggerPct: z.number().positive().max(1).optional(),
        stopLimitPct: z.number().positive().max(1).optional(),
        promotionThreshold: z.number().min(-1).max(1).optional(),
        ladderThreshold: z.number().positive().max(2).optional(),
        trailTightenAt15: z.number().positive().max(1).optional(),
        trailTightenAt20: z.number().positive().max(1).optional(),
        defaultTrail: z.number().positive().max(1).optional(),
        gapExitPct: z.number().min(-1).max(0).optional(),
        tradeWindowCapDays: z.number().int().positive().max(365).optional(),
      })
      .optional(),
    strategyBot: z.string().regex(SLUG_RE).optional(),
  })
  .optional();

export async function POST(req: Request) {
  const url = new URL(req.url);
  const account = readBotParam(url.searchParams) ?? undefined;
  const { botId, strategy, mode } = await resolveBotCtx({ account });

  let body: z.infer<typeof bodySchema> = undefined;
  // Body is optional — accept empty/no JSON without erroring.
  try {
    const text = await req.text();
    if (text.trim()) {
      const parsed = bodySchema.safeParse(JSON.parse(text));
      if (!parsed.success) {
        return NextResponse.json(
          { error: "invalid backtest body", details: parsed.error.issues },
          { status: 400 }
        );
      }
      body = parsed.data;
    }
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  // strategyBot provenance: validate it exists if provided so a typo
  // doesn't quietly persist garbage in the snapshot.
  if (body?.strategyBot) {
    const bots = await listBots();
    if (!bots.some((b) => b.id === body!.strategyBot)) {
      return NextResponse.json(
        { error: `strategyBot "${body.strategyBot}" not found` },
        { status: 404 }
      );
    }
  }

  const ctx = { bot: botId, strategy };
  try {
    const { summary, results } = await runBacktest({
      mode,
      bot: botId,
      strategy,
      strategyParams: body?.params,
    });
    if (body?.strategyBot) summary.strategySourceBot = body.strategyBot;
    await Promise.all([
      writeBacktestResults(summary, results, ctx),
      writeBacktestSnapshot(summary, results, ctx),
    ]);
    return NextResponse.json({ summary });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
