// Parser for memory/shared/PERPLEXITY-LOG.md — the cost ledger that
// scripts/perplexity.sh appends one row per API call (table-formatted:
// `| YYYY-MM-DD HH:MM <TZ> | model[ (cached)] | <prompt> |`). Used by
// the Overview "Research API spend" tile.
//
// Date semantics: rows logged AFTER scripts/perplexity.sh's CT fix carry
// CT calendar dates. Legacy rows logged on cloud routines (UTC) or local
// (CDT) carry whichever date the host TZ saw at write time — for late-CT
// entries (after ~7 PM CT in summer / ~6 PM CST), UTC has already rolled
// to the next day, so the row's date prefix is one day ahead of the CT
// trading day. We accept that small skew rather than backfilling.

import { readMemory } from "../memoryPath";
import { todayInCT, addDaysISO } from "../time";

export const PERPLEXITY_COST_PER_CALL = 0.0005;

export type PerplexityRow = {
  date: string; // YYYY-MM-DD — extracted from the leading table cell
  isCached: boolean;
};

export type PerplexitySummary = {
  rows: PerplexityRow[];
  todayCount: number;
  yesterdayCount: number;
  todayCost: number;
  rolling14dMedian: number;
  perDay: { date: string; count: number }[]; // last 14 days oldest → newest
  lastEntryDate: string | null;
  lastEntryAt: string | null; // raw timestamp string from the most recent row
};

const ROW_RE = /^\|\s*(\d{4}-\d{2}-\d{2})(?:\s+\d{2}:\d{2}(?:\s+\S+)?)?\s*\|\s*([^|]*?)\s*\|/;

export function parsePerplexityLog(raw: string): PerplexityRow[] {
  if (!raw) return [];
  const out: PerplexityRow[] = [];
  for (const line of raw.split("\n")) {
    if (!line.startsWith("| 2")) continue; // fast reject — table-row only, dates start "2"
    const m = line.match(ROW_RE);
    if (!m) continue;
    const model = m[2] || "";
    out.push({ date: m[1], isCached: /\(cached\)/.test(model) });
  }
  return out;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

export function summarizePerplexity(
  rows: PerplexityRow[],
  today: string = todayInCT()
): PerplexitySummary {
  const yesterday = addDaysISO(today, -1);
  const counts = new Map<string, number>();
  let lastEntryDate: string | null = null;
  for (const r of rows) {
    counts.set(r.date, (counts.get(r.date) ?? 0) + 1);
    if (!lastEntryDate || r.date > lastEntryDate) lastEntryDate = r.date;
  }
  const todayCount = counts.get(today) ?? 0;
  const yesterdayCount = counts.get(yesterday) ?? 0;
  const priorCounts: number[] = [];
  const perDay: { date: string; count: number }[] = [];
  for (let i = 14; i >= 1; i--) {
    const d = addDaysISO(today, -i);
    const c = counts.get(d) ?? 0;
    priorCounts.push(c);
    perDay.push({ date: d, count: c });
  }
  return {
    rows,
    todayCount,
    yesterdayCount,
    todayCost: todayCount * PERPLEXITY_COST_PER_CALL,
    rolling14dMedian: median(priorCounts),
    perDay,
    lastEntryDate,
    lastEntryAt: null, // populated by loader if a raw timestamp is needed
  };
}

export async function loadPerplexitySummary(
  today: string = todayInCT()
): Promise<PerplexitySummary> {
  const raw = await readMemory("PERPLEXITY-LOG.md");
  if (!raw) return summarizePerplexity([], today);
  const rows = parsePerplexityLog(raw);
  const summary = summarizePerplexity(rows, today);
  // Capture the raw timestamp of the most recent row for staleness display.
  const lastLine = raw
    .split("\n")
    .reverse()
    .find((l) => l.startsWith("| 2"));
  if (lastLine) {
    const m = lastLine.match(/^\|\s*(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}(?:\s+\S+)?)/);
    summary.lastEntryAt = m?.[1] ?? null;
  }
  return summary;
}
