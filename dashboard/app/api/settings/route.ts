import { NextResponse } from "next/server";
import {
  loadRedactedSettings,
  saveSettings,
  settingsPatchSchema,
} from "@/lib/settings";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    const redacted = await loadRedactedSettings();
    return NextResponse.json(redacted, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const patch = settingsPatchSchema.parse(body);
    await saveSettings(patch);
    const redacted = await loadRedactedSettings();
    return NextResponse.json(redacted, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
