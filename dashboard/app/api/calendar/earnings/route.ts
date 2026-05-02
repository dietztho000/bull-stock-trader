import { NextResponse } from "next/server";
import { loadMarketEarnings } from "@/lib/parsers/marketEarnings";
import { fetchMarketEarnings } from "@/lib/perplexity";
import { writeMarketEarnings } from "@/lib/parsers/marketEarningsWriter";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    const entries = await loadMarketEarnings();
    return NextResponse.json(
      { entries, refreshedAt: new Date().toISOString() },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST() {
  try {
    const entries = await fetchMarketEarnings({ days: 30 });
    const result = await writeMarketEarnings(entries);
    const stored = await loadMarketEarnings();
    return NextResponse.json(
      {
        ok: true,
        entries: stored,
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
