import { NextResponse } from "next/server";
import { loadEarningsCalendar } from "@/lib/parsers/earningsCalendar";
import { loadMarketEarnings } from "@/lib/parsers/marketEarnings";
import { loadEconomicCalendar } from "@/lib/parsers/economicCalendar";
import { runAlpaca } from "@/lib/alpaca";
import { readBotMode } from "@/lib/mode";
import { loadBenchmark } from "@/lib/parsers/benchmark";
import { buildPreMarketBrief, type BriefPosition, type ClockState } from "@/lib/discord/brief";
import { sendDiscord } from "@/lib/discord";
import { mergeEarnings } from "@/lib/calendar/events";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

type AlpacaPosition = {
  symbol: string;
  unrealized_plpc?: string | number | null;
};

type AlpacaClock = {
  is_open?: boolean;
  next_open?: string;
};

async function safe<T>(fn: () => Promise<T>): Promise<T | null> {
  try {
    return await fn();
  } catch {
    return null;
  }
}

async function assembleBrief(opts: { test?: boolean } = {}): Promise<{
  message: string;
  stats: {
    earningsToday: number;
    economicToday: number;
    positions: number;
    hasHighImpact: boolean;
  };
}> {
  const date = todayIso();

  if (opts.test) {
    const stamp = new Date().toISOString().replace("T", " ").slice(0, 16);
    return {
      message: `✅ Webhook test from dashboard at ${stamp} UTC`,
      stats: { earningsToday: 0, economicToday: 0, positions: 0, hasHighImpact: false },
    };
  }

  const mode = await readBotMode();

  const [earningsMap, marketEarnings, economic, positions, clockData, benchmark] = await Promise.all([
    safe(() => loadEarningsCalendar()),
    safe(() => loadMarketEarnings()),
    safe(() => loadEconomicCalendar()),
    safe(() => runAlpaca("positions", [], { mode }) as Promise<AlpacaPosition[]>),
    safe(() => runAlpaca("clock", [], { mode }) as Promise<AlpacaClock>),
    safe(() => loadBenchmark()),
  ]);

  const earnings = mergeEarnings(
    earningsMap ? Array.from(earningsMap.values()) : [],
    marketEarnings ?? []
  );
  const economicEvents = economic ?? [];

  const openPositions: BriefPosition[] = (positions ?? []).map((p) => {
    const raw = p.unrealized_plpc;
    const num = raw === null || raw === undefined ? null : Number(raw);
    return {
      symbol: p.symbol,
      unrealizedPlPct: Number.isFinite(num as number) ? (num as number) : null,
    };
  });

  const clock: ClockState | undefined = clockData
    ? { isOpen: Boolean(clockData.is_open), nextOpen: clockData.next_open }
    : undefined;

  const phaseDay = benchmark?.rows?.length ?? null;

  const message = buildPreMarketBrief({
    date,
    earnings,
    economic: economicEvents,
    openPositions,
    clock,
    phaseDay,
  });

  const earningsToday = earnings.filter((e) => e.date === date).length;
  const econToday = economicEvents.filter((e) => e.date === date);
  return {
    message,
    stats: {
      earningsToday,
      economicToday: econToday.length,
      positions: openPositions.length,
      hasHighImpact: econToday.some((e) => e.importance === "high"),
    },
  };
}

export async function GET() {
  try {
    const { message, stats } = await assembleBrief();
    return NextResponse.json(
      { message, stats },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const url = new URL(req.url);
    const test = url.searchParams.get("test") === "true";
    const { message } = await assembleBrief({ test });
    const result = await sendDiscord("research", message);
    return NextResponse.json(
      {
        ok: result.ok,
        delivery: result.delivery,
        message,
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
