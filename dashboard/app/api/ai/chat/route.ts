import { NextRequest } from "next/server";
import { getAnthropic, MODELS } from "@/lib/ai/client";
import { buildBotContext } from "@/lib/ai/context";
import { logCacheUsage } from "@/lib/ai/promptCache";
import { readBotParam, resolveBotCtx } from "@/lib/resolveAccount";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type ChatTurn = { role: "user" | "assistant"; content: string };

export async function POST(req: NextRequest) {
  let body: { messages?: ChatTurn[] };
  try {
    body = await req.json();
  } catch {
    return new Response("invalid json", { status: 400 });
  }
  const messages = (body.messages ?? []).filter(
    (m) => (m.role === "user" || m.role === "assistant") && m.content?.trim()
  );
  if (!messages.length || messages[messages.length - 1].role !== "user") {
    return new Response("expected last message to be user", { status: 400 });
  }

  const { botId, strategy } = await resolveBotCtx({
    account: readBotParam(req.nextUrl.searchParams) ?? undefined,
  });

  let client, context;
  try {
    client = getAnthropic();
    context = await buildBotContext({ bot: botId, strategy });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "setup failed";
    return new Response(msg, { status: 500 });
  }

  const stream = client.messages.stream({
    model: MODELS.chat,
    max_tokens: 1024,
    system: context.system,
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
  });

  const encoder = new TextEncoder();
  const sseStream = new ReadableStream({
    async start(controller) {
      try {
        stream.on("text", (delta) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ delta })}\n\n`));
        });
        const final = await stream.finalMessage();
        await logCacheUsage("chat", final.usage);
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true })}\n\n`));
      } catch (err) {
        const msg = err instanceof Error ? err.message : "stream error";
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: msg })}\n\n`));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(sseStream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
