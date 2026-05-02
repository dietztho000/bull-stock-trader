import { NextResponse } from "next/server";
import { loadEconomicCalendar } from "@/lib/parsers/economicCalendar";
import { fetchEconomicCalendar } from "@/lib/perplexity";
import { writeEconomicCalendar } from "@/lib/parsers/economicCalendarWriter";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    const events = await loadEconomicCalendar();
    return NextResponse.json(
      { events, refreshedAt: new Date().toISOString() },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST() {
  try {
    const events = await fetchEconomicCalendar({ days: 14 });
    const result = await writeEconomicCalendar(events);
    const stored = await loadEconomicCalendar();
    return NextResponse.json(
      {
        ok: true,
        events: stored,
        merge: result,
        refreshedAt: new Date().toISOString(),
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const status = /PERPLEXITY_API_KEY/.test(msg) ? 503 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
