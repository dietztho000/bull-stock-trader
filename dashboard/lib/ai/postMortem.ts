import crypto from "node:crypto";
import type Anthropic from "@anthropic-ai/sdk";
import { getAnthropic, MODELS } from "./client";
import { buildBotContext } from "./context";
import { logCacheUsage } from "./promptCache";
import { loadTradeLog } from "../parsers/tradeLog";
import { loadSectorLedger } from "../parsers/sectorLedger";
import type { MemoryCtx } from "../memoryPath";

export type PostMortemResult =
  | { ok: true; text: string; generatedAt: string; cacheHit: boolean }
  | { ok: false; error: string; status: 400 | 404 | 500 };

type CacheEntry = { text: string; generatedAt: string; sig: string };
const cache = new Map<string, CacheEntry>();
const TTL_MS = 6 * 60 * 60 * 1000;

export async function getPostMortem(
  rawSymbol: string,
  entryDate: string | null,
  ctx: MemoryCtx
): Promise<PostMortemResult> {
  const symbol = rawSymbol.trim().toUpperCase();
  if (!symbol) return { ok: false, error: "symbol required", status: 400 };

  const [tradeLog, ledger] = await Promise.all([
    loadTradeLog(ctx),
    loadSectorLedger(ctx),
  ]);

  const closed = ledger.closed.find(
    (t) => t.symbol.toUpperCase() === symbol && (!entryDate || t.date === entryDate)
  );
  const entry = tradeLog.entries.find(
    (e) => e.ticker.toUpperCase() === symbol && (!entryDate || e.date === entryDate)
  );

  if (!closed && !entry) {
    return {
      ok: false,
      error: `no record found for ${symbol}${entryDate ? ` on ${entryDate}` : ""}`,
      status: 404,
    };
  }

  const sig = signatureOf(closed, entry);
  const key = `${ctx.bot}:${ctx.strategy ?? "default"}:${symbol}:${entryDate ?? ""}`;
  const hit = cache.get(key);
  if (
    hit &&
    hit.sig === sig &&
    Date.now() - new Date(hit.generatedAt).getTime() < TTL_MS
  ) {
    return { ok: true, text: hit.text, generatedAt: hit.generatedAt, cacheHit: true };
  }

  let client, context;
  try {
    client = getAnthropic();
    context = await buildBotContext(ctx);
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "setup failed",
      status: 500,
    };
  }

  const prompt = `Write a post-mortem for trade ${symbol}${
    entryDate ? ` (entry ${entryDate})` : ""
  }. Use exactly 4 short bullets, in this order:

1. **Thesis vs outcome** — what was the catalyst, what actually happened, did rules trigger correctly
2. **Scorer accuracy** — was the entry score (catalyst/momentum/R:R/stop) consistent with the outcome
3. **Rule check** — which rules fired (sizing, stop, take-profit ladder, sector cap, etc.) and whether discipline held
4. **Lesson** — one short sentence the operator should remember

Closed trade record (from SECTOR-LEDGER.md):
${closed ? JSON.stringify(closed, null, 2) : "(not in sector ledger)"}

Entry record (from TRADE-LOG.md):
${entry ? JSON.stringify(entry, null, 2) : "(no entry scorer captured)"}`;

  let response;
  try {
    response = await client.messages.create({
      model: MODELS.postMortem,
      max_tokens: 700,
      system: context.system,
      messages: [{ role: "user", content: prompt }],
    });
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "API call failed",
      status: 500,
    };
  }

  await logCacheUsage("post-mortem", response.usage);

  const text = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n");

  const generatedAt = new Date().toISOString();
  cache.set(key, { text, generatedAt, sig });
  return { ok: true, text, generatedAt, cacheHit: false };
}

function signatureOf(closed: unknown, entry: unknown): string {
  const blob = JSON.stringify({ closed: closed ?? null, entry: entry ?? null });
  return crypto.createHash("sha1").update(blob).digest("hex").slice(0, 12);
}
