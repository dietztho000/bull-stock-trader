import { NextResponse } from "next/server";
import { loadEarningsCalendar } from "@/lib/parsers/earningsCalendar";
import { loadMarketEarnings } from "@/lib/parsers/marketEarnings";
import { loadEconomicCalendar } from "@/lib/parsers/economicCalendar";
import { runAlpaca, type RunAlpacaOpts } from "@/lib/alpaca";
import { readBotMode } from "@/lib/mode";
import { loadBenchmark } from "@/lib/parsers/benchmark";
import {
  buildPreMarketBrief,
  type BriefPosition,
  type BriefRiskState,
  type ClockState,
} from "@/lib/discord/brief";
import { sendDiscord } from "@/lib/discord";
import { mergeEarnings } from "@/lib/calendar/events";
import { todayInCT, fmtDateTimeCT } from "@/lib/time";
import { getSuppressionReason, loadSettings } from "@/lib/settings";
import { loadStrategyState } from "@/lib/strategyState";
import { readBotParam, resolveBotCtx } from "@/lib/resolveAccount";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function todayIso(): string {
  return todayInCT();
}

type AlpacaPosition = {
  symbol: string;
  unrealized_plpc?: string | number | null;
};

type AlpacaClock = {
  is_open?: boolean;
  next_open?: string;
};

type Warning = { source: string; message: string };

async function safeNamed<T>(
  source: string,
  fn: () => Promise<T>,
  warnings: Warning[]
): Promise<T | null> {
  try {
    return await fn();
  } catch (err) {
    warnings.push({
      source,
      message: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

async function assembleBrief(opts: {
  test?: boolean;
  account?: string;
} = {}): Promise<{
  message: string;
  warnings: Warning[];
  stats: {
    earningsToday: number;
    economicToday: number;
    positions: number;
    hasHighImpact: boolean;
  };
}> {
  const date = todayIso();

  if (opts.test) {
    return {
      message: `✅ Webhook test from dashboard at ${fmtDateTimeCT(new Date())} CT`,
      warnings: [],
      stats: { earningsToday: 0, economicToday: 0, positions: 0, hasHighImpact: false },
    };
  }

  const { botId, strategy, accountId } = await resolveBotCtx({ account: opts.account });
  const ctx = { bot: botId, strategy };
  // When the bot has no registry-bound account, fall back to the host's
  // legacy BOT_MODE — never silently default to live for any non-"paper"
  // bot id, which would route a paper-bot brief through the live account.
  const runOpts: RunAlpacaOpts = accountId
    ? { accountId, botId }
    : { mode: await readBotMode() };
  const settings = await loadSettings();
  const warnings: Warning[] = [];

  const [earningsMap, marketEarnings, economic, positions, clockData, benchmark, strategyState] = await Promise.all([
    safeNamed("earnings calendar", () => loadEarningsCalendar(ctx), warnings),
    safeNamed("market earnings", () => loadMarketEarnings(), warnings),
    safeNamed("economic calendar", () => loadEconomicCalendar(), warnings),
    safeNamed(
      "alpaca positions",
      () => runAlpaca("positions", [], runOpts) as Promise<AlpacaPosition[]>,
      warnings
    ),
    safeNamed(
      "alpaca clock",
      () => runAlpaca("clock", [], runOpts) as Promise<AlpacaClock>,
      warnings
    ),
    safeNamed("benchmark", () => loadBenchmark(ctx), warnings),
    safeNamed("strategy state", () => loadStrategyState({ bot: botId, strategy }), warnings),
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

  // Breaker booleans now live on strategyState (audit F7) so the watcher
  // and the brief share one source of truth — no more divergent thresholds.
  const risk: BriefRiskState | undefined = strategyState
    ? {
        dayBreakerActive: strategyState.dayBreakerActive ?? false,
        weekBreakerActive: strategyState.weekBreakerActive ?? false,
        sectorsAtCap: strategyState.sectorsAtCap,
        blockedSectors: strategyState.blockedSectors,
        cooldowns: strategyState.cooldownSymbols.map((c) => ({
          symbol: c.symbol,
          daysRemaining: c.daysRemaining,
        })),
        earningsGateHeld: strategyState.earningsT2Held.map((e) => ({
          symbol: e.symbol,
          daysUntil: e.daysUntil,
          type: e.type,
        })),
        blockedIdeas: strategyState.blockedIdeas.map((i) => ({
          symbol: i.symbol,
          reason: i.reason,
          detail: i.detail,
        })),
        slotsUsed: strategyState.slotsUsed,
        slotsCap: strategyState.slotsCap,
      }
    : undefined;

  const message = buildPreMarketBrief({
    date,
    earnings,
    economic: economicEvents,
    openPositions,
    clock,
    phaseDay,
    risk,
  });

  const earningsToday = earnings.filter((e) => e.date === date).length;
  const econToday = economicEvents.filter((e) => e.date === date);
  return {
    message,
    warnings,
    stats: {
      earningsToday,
      economicToday: econToday.length,
      positions: openPositions.length,
      hasHighImpact: econToday.some((e) => e.importance === "high"),
    },
  };
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const account = readBotParam(url.searchParams) ?? undefined;
    const { message, warnings, stats } = await assembleBrief({ account });
    return NextResponse.json(
      { message, warnings, stats },
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
    const account = readBotParam(url.searchParams) ?? undefined;
    const { message } = await assembleBrief({ test, account });

    // Test sends bypass user-configured filters and quiet hours so the user
    // can verify the webhook without fighting their own preferences.
    if (!test) {
      const settings = await loadSettings();
      const reason = getSuppressionReason(settings, "research");
      if (reason) {
        return NextResponse.json(
          {
            ok: true,
            delivery: "suppressed",
            suppressedReason: reason,
            message,
          },
          { headers: { "Cache-Control": "no-store" } }
        );
      }
    }

    // Per-bot webhook override (audit F10) routes the brief to the bot's
    // dedicated channel when set; falls back to the global webhook otherwise.
    const briefBot = await resolveBotCtx({ account });
    const result = await sendDiscord("research", message, { botId: briefBot.botId });
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
