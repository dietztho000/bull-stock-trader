import { NextResponse } from "next/server";
import { importSettings, loadRedactedSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    await importSettings(body);
    const redacted = await loadRedactedSettings();
    return NextResponse.json(redacted, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
