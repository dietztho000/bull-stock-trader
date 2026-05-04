import { subscribe } from "@/lib/watch";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const stream = new ReadableStream({
    start(controller) {
      const enc = new TextEncoder();
      controller.enqueue(enc.encode(`: connected\n\n`));
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(enc.encode(`: hb\n\n`));
        } catch {
          /* closed */
        }
      }, 15000);
      const unsub = subscribe((batch) => {
        // Trim per-event detail to keep the SSE payload small. Clients only
        // need: which bots changed (for filtering router.refresh), and which
        // memory files (for diagnostics).
        const payload = {
          bots: batch.bots,
          firstAt: batch.firstAt,
          events: batch.events.map((e) => ({
            file: e.file,
            bot: e.bot,
            strategy: e.strategy,
            relPath: e.relPath,
          })),
        };
        try {
          controller.enqueue(enc.encode(`data: ${JSON.stringify(payload)}\n\n`));
        } catch {
          /* closed */
        }
      });
      // @ts-expect-error attach for cleanup
      controller._cleanup = () => {
        clearInterval(heartbeat);
        unsub();
      };
    },
    cancel() {
      // controller cleanup is handled in start via setInterval close
    },
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
