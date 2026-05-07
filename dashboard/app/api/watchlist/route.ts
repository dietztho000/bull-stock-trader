// NEW 2026-05-06: shared watchlist API. GET returns the list, POST adds
// a symbol, DELETE removes one. The /calendar page calls these to toggle
// star icons; the refresh-market-earnings cron routine reads the file
// directly (not via this endpoint).
import { NextResponse } from "next/server";
import {
  loadWatchlist,
  addToWatchlist,
  removeFromWatchlist,
} from "@/lib/parsers/watchlist";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    const entries = await loadWatchlist();
    return NextResponse.json(
      { entries },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      symbol?: string;
      note?: string;
    };
    if (!body.symbol) {
      return NextResponse.json(
        { error: "symbol is required" },
        { status: 400 }
      );
    }
    const result = await addToWatchlist(body.symbol, body.note ?? "");
    return NextResponse.json(
      { ok: true, ...result },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

export async function DELETE(req: Request) {
  try {
    const url = new URL(req.url);
    const symbol =
      url.searchParams.get("symbol") ??
      (await req.json().catch(() => ({}) as { symbol?: string })).symbol;
    if (!symbol) {
      return NextResponse.json(
        { error: "symbol is required" },
        { status: 400 }
      );
    }
    const result = await removeFromWatchlist(symbol);
    return NextResponse.json(
      { ok: true, ...result },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
