import { NextResponse } from "next/server";
import { loadResearchLog } from "@/lib/parsers/researchLog";
import { loadSectorLedger } from "@/lib/parsers/sectorLedger";
import { readBotParam, resolveBotCtx } from "@/lib/resolveAccount";
import { getAccountPositions } from "@/lib/bots/perBotPositions";
import { listBots } from "@/lib/settings";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const TICKER_RE = /\b([A-Z]{1,5})\b/g;

/** Audit F8 — symbol suggestions for OrderEntryTile autocomplete. Pulls
 *  candidates from three sources, in this priority order:
 *
 *    1. Currently-held positions (most actionable — user likely wants to
 *       size up or trim something they already own).
 *    2. Today's RESEARCH-LOG ideas (the bot's vetted shortlist).
 *    3. Recently closed trades (familiar tickers the user may want to
 *       re-enter — gated by rule #20 cooldown but still relevant).
 *
 *  Each candidate is annotated with its source so the UI can label rows
 *  ("held", "research", "recent") instead of a flat blob of tickers. */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const { botId, strategy } = await resolveBotCtx({
      bot: readBotParam(url.searchParams) ?? undefined,
    });
    const ctx = { bot: botId, strategy };
    const bots = await listBots();
    const bot = bots.find((b) => b.id === botId);

    const [research, ledger, positionsRaw] = await Promise.all([
      loadResearchLog(ctx).catch(() => []),
      loadSectorLedger(ctx).catch(() => ({ closed: [] })),
      bot
        ? getAccountPositions(bot.accountId).catch(() => [])
        : Promise.resolve([]),
    ]);

    const seen = new Set<string>();
    const suggestions: Array<{ symbol: string; source: string; detail?: string }> = [];

    function add(symbol: string, source: string, detail?: string) {
      const sym = symbol.toUpperCase();
      if (seen.has(sym)) return;
      if (!/^[A-Z]{1,5}$/.test(sym)) return;
      seen.add(sym);
      suggestions.push({ symbol: sym, source, detail });
    }

    // 1. Held positions — sorted by market value descending so the largest
    // ones bubble to the top of the suggestion list.
    const positions = Array.isArray(positionsRaw) ? positionsRaw : [];
    const sortedPositions = [...positions].sort(
      (a, b) => Math.abs(Number(b.market_value ?? 0)) - Math.abs(Number(a.market_value ?? 0))
    );
    for (const p of sortedPositions) {
      add(p.symbol, "held", `${p.qty} sh`);
    }

    // 2. Research ideas — most-recent entry first.
    const todayResearch = research[0] ?? null;
    if (todayResearch) {
      for (const idea of todayResearch.ideas) {
        const matches = idea.matchAll(TICKER_RE);
        for (const m of matches) {
          add(m[1], "research", idea.length > 60 ? idea.slice(0, 60) + "…" : idea);
          break; // first ticker per idea
        }
      }
    }

    // 3. Recent closed trades — last 5 distinct symbols, newest first.
    const recentClosed = [...ledger.closed]
      .sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""))
      .slice(0, 20);
    for (const t of recentClosed) {
      if (suggestions.length >= 50) break;
      add(t.symbol, "recent", `last close ${t.date}${t.outcome ? ` · ${t.outcome}` : ""}`);
    }

    return NextResponse.json(
      { botId, suggestions: suggestions.slice(0, 50) },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
