import { NextResponse } from "next/server";
import { sendDiscord } from "@/lib/discord";
import { listBots, loadSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** POST /api/alerts/dispatch
 *
 *  Server-side dispatcher for client-fired alerts (audit F8). The watcher
 *  in lib/useAlertWatcher.ts evaluates rules in the browser; when a rule
 *  has channels.discord or channels.ntfy enabled, the watcher POSTs here
 *  and the server fans out to the configured webhook(s) via the
 *  discord.sh wrapper (--type=alert auto-routes to ntfy when a topic is
 *  set, falling back to Discord when not).
 *
 *  Request body:
 *    { ruleId: string, signature: string, title: string, detail?: string,
 *      channels: { discord?: boolean, ntfy?: boolean }, botId?: string }
 *
 *  Idempotency: the watcher already dedupes by `${ruleId}:${signature}`
 *  client-side, so this route does not maintain its own server-side
 *  dedup. A page reload (or a stop_everywhere cleared the firedRef) can
 *  cause a re-send; that's intentional — Discord rate-limits handle
 *  burst spam and the user gets fresh visibility after a refresh.
 */
export async function POST(req: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid json" }, { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json({ ok: false, error: "invalid body" }, { status: 400 });
  }

  const {
    ruleId,
    signature,
    title,
    detail,
    channels,
    botId,
  } = body as {
    ruleId?: unknown;
    signature?: unknown;
    title?: unknown;
    detail?: unknown;
    channels?: { discord?: unknown; ntfy?: unknown };
    botId?: unknown;
  };

  if (typeof ruleId !== "string" || typeof signature !== "string" || typeof title !== "string") {
    return NextResponse.json(
      { ok: false, error: "ruleId, signature, title required as strings" },
      { status: 400 }
    );
  }

  const wantDiscord = Boolean(channels?.discord);
  const wantNtfy = Boolean(channels?.ntfy);
  if (!wantDiscord && !wantNtfy) {
    // Nothing to do — toast-only routes never hit this endpoint.
    return NextResponse.json({ ok: true, delivery: "skipped" });
  }

  // Validate the bot id (when provided) against the registry so a bogus
  // value doesn't silently route to the global webhook.
  let resolvedBotId: string | undefined;
  if (typeof botId === "string" && botId.length > 0) {
    const bots = await listBots();
    if (bots.some((b) => b.id === botId)) resolvedBotId = botId;
  }

  // Compose the message. discord.sh adds the category emoji prefix.
  const lines = [title.trim()];
  if (typeof detail === "string" && detail.trim()) lines.push(detail.trim());
  lines.push(`(rule ${ruleId})`);
  const message = lines.join("\n");

  // Settings sanity: no webhook + no ntfy = nothing useful to do.
  const settings = await loadSettings();
  const hasWebhook = Boolean(settings.discord.webhookUrl);
  const hasNtfy = Boolean(settings.discord.ntfyTopic);
  if (!hasWebhook && !hasNtfy) {
    return NextResponse.json(
      { ok: false, error: "no Discord webhook or ntfy topic configured" },
      { status: 422 }
    );
  }

  try {
    const result = await sendDiscord("alert", message, { botId: resolvedBotId });
    return NextResponse.json({ ok: true, delivery: result.delivery });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "dispatch failed" },
      { status: 502 }
    );
  }
}
