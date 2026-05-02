import type Anthropic from "@anthropic-ai/sdk";
import { NextRequest } from "next/server";
import { getAnthropic, MODELS } from "@/lib/ai/client";
import { buildBotContext } from "@/lib/ai/context";
import { logCacheUsage } from "@/lib/ai/promptCache";
import { loadTradeLog } from "@/lib/parsers/tradeLog";
import { loadSectorLedger } from "@/lib/parsers/sectorLedger";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  let body: { symbol?: string; entryDate?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "invalid json" }, { status: 400 });
  }
  const symbol = body.symbol?.toUpperCase();
  const entryDate = body.entryDate;
  if (!symbol) {
    return Response.json({ error: "symbol required" }, { status: 400 });
  }

  let client, context;
  try {
    client = getAnthropic();
    context = await buildBotContext();
  } catch (err) {
    const msg = err instanceof Error ? err.message : "setup failed";
    return Response.json({ error: msg }, { status: 500 });
  }

  const [tradeLog, ledger] = await Promise.all([
    loadTradeLog(),
    loadSectorLedger(),
  ]);

  const closed = ledger.closed.find(
    (t) => t.symbol.toUpperCase() === symbol && (!entryDate || t.date === entryDate)
  );
  const entry = tradeLog.entries.find(
    (e) => e.ticker.toUpperCase() === symbol && (!entryDate || e.date === entryDate)
  );

  if (!closed && !entry) {
    return Response.json(
      { error: `no record found for ${symbol}${entryDate ? ` on ${entryDate}` : ""}` },
      { status: 404 }
    );
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
    const msg = err instanceof Error ? err.message : "API call failed";
    return Response.json({ error: msg }, { status: 500 });
  }

  await logCacheUsage("post-mortem", response.usage);

  const text = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n");

  return Response.json({ text });
}
