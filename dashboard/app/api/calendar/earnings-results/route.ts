// NEW 2026-05-06: back-fill `Actual EPS` and `1-day move %` onto past-dated
// rows in MARKET-EARNINGS.md. The refresh-earnings-results cron routine
// POSTs to this endpoint daily; manual refresh is also possible from
// `pnpm dev` for testing.
import { NextResponse } from "next/server";
import { loadMarketEarnings } from "@/lib/parsers/marketEarnings";
import { writeEarningsResults } from "@/lib/parsers/marketEarningsWriter";
import { fetchEarningsResults } from "@/lib/perplexity";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export async function POST() {
  try {
    const today = todayIso();
    const all = await loadMarketEarnings();
    // Only past-dated rows that don't already have results back-filled.
    const candidates = all
      .filter((e) => e.date < today)
      .filter((e) => !e.actualEps || !e.postPrintMovePct)
      .map((e) => ({ symbol: e.symbol, date: e.date }));

    if (candidates.length === 0) {
      return NextResponse.json(
        {
          ok: true,
          updated: 0,
          skipped: 0,
          message: "no candidates (all past rows already back-filled)",
          refreshedAt: new Date().toISOString(),
        },
        { headers: { "Cache-Control": "no-store" } }
      );
    }

    const results = await fetchEarningsResults(candidates);
    const writeResult = await writeEarningsResults(results);

    return NextResponse.json(
      {
        ok: true,
        candidates: candidates.length,
        fetched: results.length,
        ...writeResult,
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
