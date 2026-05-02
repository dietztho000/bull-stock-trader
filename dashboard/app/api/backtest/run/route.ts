import { NextResponse } from "next/server";
import { runBacktest } from "@/lib/backtest/runner";
import { writeBacktestResults } from "@/lib/backtest/output";
import { writeBacktestSnapshot } from "@/lib/backtest/cache";
import type { AlpacaMode } from "@/lib/alpaca";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function parseMode(raw: string | null): AlpacaMode | undefined {
  if (raw === "paper" || raw === "live") return raw;
  return undefined;
}

export async function POST(req: Request) {
  const url = new URL(req.url);
  const mode = parseMode(url.searchParams.get("mode")) ?? "paper";
  try {
    const { summary, results } = await runBacktest(mode);
    await Promise.all([
      writeBacktestResults(summary, results),
      writeBacktestSnapshot(summary, results),
    ]);
    return NextResponse.json({ summary });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
