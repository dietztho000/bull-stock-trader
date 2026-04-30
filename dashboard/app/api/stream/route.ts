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
      const unsub = subscribe((file) => {
        try {
          controller.enqueue(enc.encode(`data: ${JSON.stringify({ file })}\n\n`));
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
