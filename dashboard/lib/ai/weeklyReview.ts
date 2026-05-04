import crypto from "node:crypto";
import type Anthropic from "@anthropic-ai/sdk";
import { getAnthropic, MODELS } from "./client";
import { buildBotContext } from "./context";
import { logCacheUsage } from "./promptCache";
import { loadSectorLedger } from "../parsers/sectorLedger";
import { loadBenchmark } from "../parsers/benchmark";
import { loadWeeklyReviews } from "../parsers/weeklyReview";
import { addDaysISO, currentWeekMondayCT, todayInCT } from "../time";
import type { MemoryCtx } from "../memoryPath";

export type WeeklyReviewDraftResult =
  | {
      ok: true;
      draft: string;
      weekEnding: string;
      generatedAt: string;
      cacheHit: boolean;
    }
  | { ok: false; error: string; status: 400 | 404 | 500 };

type CacheEntry = { draft: string; generatedAt: string; sig: string };
const cache = new Map<string, CacheEntry>();
const TTL_MS = 60 * 60 * 1000; // 1h — same trading week is stable for the day

/** Audit F10 — generate a Friday weekly-review draft from the bot's
 *  trade ledger + benchmark for the current trading week (Mon → Fri CT).
 *  Mirrors the existing WEEKLY-REVIEW.md template that the Friday routine
 *  produces, so the operator can edit the draft and paste it in directly.
 *
 *  The bot's CLAUDE.md voice rules apply (ultra-concise, no preamble,
 *  cite rule numbers + trade dates). Draft is cached per-bot-per-week so
 *  flipping in/out of the journal page doesn't re-bill the API. */
export async function getWeeklyReviewDraft(
  ctx: MemoryCtx
): Promise<WeeklyReviewDraftResult> {
  // Friday CT is the canonical "week ending". For non-Friday calls we
  // still use the upcoming-or-current Friday so the same week's draft is
  // stable regardless of which weekday the user clicks.
  const monday = currentWeekMondayCT();
  const friday = addDaysISO(monday, 4); // Mon..Fri = +4
  const today = todayInCT();
  const weekEnding = today >= friday ? friday : friday;

  const [ledger, benchmark, weeklyReviews] = await Promise.all([
    loadSectorLedger(ctx),
    loadBenchmark(ctx),
    loadWeeklyReviews(ctx),
  ]);

  const closedThisWeek = ledger.closed.filter(
    (t) => t.date >= monday && t.date <= friday
  );
  const benchmarkThisWeek = benchmark.rows.filter(
    (r) => r.date >= monday && r.date <= friday
  );

  // Refuse to draft if the week has zero trade activity AND zero benchmark
  // rows — likely a fresh bot or a wrong-week call. Better to surface the
  // gap than burn an API call producing a "no activity" review.
  if (closedThisWeek.length === 0 && benchmarkThisWeek.length === 0) {
    return {
      ok: false,
      error: `No trade or benchmark activity for ${monday}..${friday}. Confirm the bot ran this week, then try again.`,
      status: 404,
    };
  }

  const sig = signatureOf({ closedThisWeek, benchmarkThisWeek });
  const key = `${ctx.bot}:${ctx.strategy ?? "default"}:${weekEnding}`;
  const hit = cache.get(key);
  if (
    hit &&
    hit.sig === sig &&
    Date.now() - new Date(hit.generatedAt).getTime() < TTL_MS
  ) {
    return {
      ok: true,
      draft: hit.draft,
      weekEnding,
      generatedAt: hit.generatedAt,
      cacheHit: true,
    };
  }

  let client, context;
  try {
    client = getAnthropic();
    context = await buildBotContext(ctx);
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "setup failed",
      status: 500,
    };
  }

  // Surface the most recent prior weekly review so the model can match the
  // bot's existing tone + section structure. Fall back to a template hint
  // when no prior reviews exist.
  const recentReview = weeklyReviews[0];

  const prompt = `Draft this Friday's weekly review entry for the trading week of ${monday} → ${weekEnding}. Match the bot's existing WEEKLY-REVIEW.md format exactly so the operator can paste it in with no edits.

Required structure:

## Week ending ${weekEnding}

### Stats
| Metric | Value |
|--------|-------|
| <key metrics rows>

### What worked
- <2-3 bullets — concrete, dated, rule-cited>

### What didn't
- <2-3 bullets — same standards>

### Adjustments for next week
- <2-3 bullets — specific rule changes or focus shifts>

### Overall Grade: <A | B | C | D | F, with optional + / ->

Voice rules apply (ultra concise, no preamble, no fluff). Cite trade dates (e.g. ${monday}) and rule numbers (e.g. rule #14, rule #17, rule #20) when relevant. Do not invent trades — use only the data below.

# Closed trades this week (from SECTOR-LEDGER.md)
${closedThisWeek.length === 0 ? "(none)" : JSON.stringify(closedThisWeek, null, 2)}

# Benchmark rows this week (from BENCHMARK.md)
${benchmarkThisWeek.length === 0 ? "(none)" : JSON.stringify(benchmarkThisWeek, null, 2)}

${
  recentReview
    ? `# Last weekly review (for tone + structure reference — do NOT copy content)\n\n${recentReview.body.slice(0, 1500)}`
    : ""
}`;

  let response;
  try {
    response = await client.messages.create({
      model: MODELS.postMortem,
      max_tokens: 1200,
      system: context.system,
      messages: [{ role: "user", content: prompt }],
    });
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "API call failed",
      status: 500,
    };
  }

  await logCacheUsage("weekly-review-draft", response.usage);

  const draft = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();

  const generatedAt = new Date().toISOString();
  cache.set(key, { draft, generatedAt, sig });
  return { ok: true, draft, weekEnding, generatedAt, cacheHit: false };
}

function signatureOf(input: unknown): string {
  return crypto
    .createHash("sha1")
    .update(JSON.stringify(input))
    .digest("hex")
    .slice(0, 12);
}
