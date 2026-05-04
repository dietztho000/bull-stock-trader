import type Anthropic from "@anthropic-ai/sdk";
import { getAnthropic, MODELS } from "./client";
import { buildBotContext } from "./context";
import { logCacheUsage } from "./promptCache";
import { loadBenchmark } from "../parsers/benchmark";
import type { MemoryCtx } from "../memoryPath";

export type DrawdownResult =
  | { triggered: false }
  | { triggered: true; narrative: string; generatedAt: string }
  | { triggered: true; error: string };

type CacheEntry = { narrative: string; generatedAt: string; key: string };
const cached = new Map<string, CacheEntry>();
const TTL_MS = 10 * 60 * 1000;

export async function getDrawdownNarrative(ctx: MemoryCtx): Promise<DrawdownResult> {
  const benchmark = await loadBenchmark(ctx);
  const last = benchmark.rows[benchmark.rows.length - 1];
  const phasePct = last?.phasePct ?? null;
  const dayPct = last?.dayPct ?? null;
  const triggered =
    (phasePct != null && phasePct < 0) || (dayPct != null && dayPct < -0.01);
  if (!triggered) return { triggered: false };

  const cacheKey = `${ctx.bot}:${ctx.strategy ?? "default"}`;
  const key = `${last?.date ?? ""}:${phasePct ?? ""}:${dayPct ?? ""}`;
  const hit = cached.get(cacheKey);
  if (
    hit &&
    hit.key === key &&
    Date.now() - new Date(hit.generatedAt).getTime() < TTL_MS
  ) {
    return {
      triggered: true,
      narrative: hit.narrative,
      generatedAt: hit.generatedAt,
    };
  }

  let client, context;
  try {
    client = getAnthropic();
    context = await buildBotContext(ctx);
  } catch (err) {
    return {
      triggered: true,
      error: err instanceof Error ? err.message : "setup failed",
    };
  }

  const prompt = `Current state: phase P&L ${
    phasePct != null ? `${(phasePct * 100).toFixed(2)}%` : "n/a"
  }, today's day P&L ${dayPct != null ? `${(dayPct * 100).toFixed(2)}%` : "n/a"}.

Write 2-3 short sentences explaining WHY the account is in drawdown. Cover:
- The proximate driver (which trades, which sectors)
- Whether rule discipline held (stops fired correctly, no override)
- What re-entry guardrails are now in effect (rule #20 cooldowns, sector blocks per rule #10)

No preamble. No "The account is currently…". Start directly with the explanation.`;

  let response;
  try {
    response = await client.messages.create({
      model: MODELS.drawdown,
      max_tokens: 400,
      system: context.system,
      messages: [{ role: "user", content: prompt }],
    });
  } catch (err) {
    return {
      triggered: true,
      error: err instanceof Error ? err.message : "API call failed",
    };
  }

  await logCacheUsage("drawdown", response.usage);

  const narrative = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();

  const generatedAt = new Date().toISOString();
  cached.set(cacheKey, { narrative, generatedAt, key });
  return { triggered: true, narrative, generatedAt };
}
