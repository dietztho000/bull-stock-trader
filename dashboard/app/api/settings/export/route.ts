import { NextResponse } from "next/server";
import { loadSettingsForExport } from "@/lib/settings";
import { todayInCT } from "@/lib/time";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    const exported = await loadSettingsForExport();
    const body = JSON.stringify(exported, null, 2) + "\n";
    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store",
        "Content-Disposition": `attachment; filename="dashboard-settings-${todayInCT()}.json"`,
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
