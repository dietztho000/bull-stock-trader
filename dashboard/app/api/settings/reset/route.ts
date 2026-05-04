import { NextResponse } from "next/server";
import { z } from "zod";
import { loadRedactedSettings, resetSection } from "@/lib/settings";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const resetBody = z.object({
  section: z
    .enum(["discord", "display", "live", "defaults", "notifications", "mascot", "all"])
    .default("all"),
});

export async function POST(req: Request) {
  try {
    const json = await req.json().catch(() => ({}));
    const { section } = resetBody.parse(json);
    await resetSection(section);
    const redacted = await loadRedactedSettings();
    return NextResponse.json(redacted, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
