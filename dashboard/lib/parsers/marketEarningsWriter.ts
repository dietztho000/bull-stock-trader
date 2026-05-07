import path from "node:path";
import fs from "node:fs/promises";
import { resolveMemoryFile } from "../memoryPath";
import type { EarningsEntry } from "./earningsCalendar.shared";

const FILE = resolveMemoryFile("MARKET-EARNINGS.md");

// REVAMPED 2026-05-06: added two optional trailing columns (`Actual EPS`,
// `1-day move %`) that the refresh-earnings-results routine back-fills for
// past-dated rows. Old files without these columns continue to parse fine
// because parseMdTable returns "" for missing headers, and the writer
// migrates rows to the new header on next refresh.
const HEADER = `| Symbol | Company | Earnings Date | BMO/AMC | EPS Estimate | Source | Date refreshed | Actual EPS | 1-day move % |\n|--------|---------|---------------|---------|--------------|--------|----------------|------------|--------------|`;

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function rowKey(symbol: string, date: string): string {
  return `${symbol.toUpperCase()}::${date}`;
}

function escapeCell(s: string): string {
  return s.replace(/\|/g, "\\|").trim();
}

function rowFor(e: EarningsEntry, refreshed: string): string {
  return [
    "",
    e.symbol.toUpperCase(),
    escapeCell(e.company ?? ""),
    e.date,
    e.type,
    escapeCell(e.epsEstimate ?? ""),
    escapeCell(e.source || "Perplexity"),
    refreshed,
    escapeCell(e.actualEps ?? ""),
    escapeCell(e.postPrintMovePct ?? ""),
    "",
  ].join(" | ").trim();
}

/**
 * Idempotent refresh, mirroring economicCalendarWriter:
 * - Drop all `Perplexity`-sourced rows whose Date is in the future.
 * - Preserve any non-Perplexity rows (Source = "manual" / "WebSearch").
 * - Drop rows whose Date is before today (housekeeping).
 * - Insert all incoming events.
 */
export async function writeMarketEarnings(
  entries: EarningsEntry[],
  opts: { refreshed?: string } = {}
): Promise<{ added: number; replaced: number; dropped: number; total: number }> {
  const refreshed = opts.refreshed ?? todayIso();
  const existing = await readFileSafely();
  const { prelude, oldRows } = splitFile(existing);

  const today = todayIso();
  // REVAMPED 2026-05-06: keep past rows for 14 days so the
  // refresh-earnings-results routine has a back-fill window. Older rows
  // are dropped as housekeeping (file size cap).
  const retentionFloor = (() => {
    const m = today.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return today;
    const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    d.setDate(d.getDate() - 14);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  })();
  const merged = new Map<string, string>();
  let dropped = 0;

  for (const line of oldRows) {
    const parsed = parseRowLine(line);
    if (!parsed) continue;
    if (parsed.date < retentionFloor) {
      dropped += 1;
      continue;
    }
    // Past rows in the retention window keep ALL their cells (incl. any
    // back-filled Actual EPS / 1-day move). Only future Perplexity rows
    // get dropped + reinserted from the fresh fetch.
    if (parsed.date >= today && /perplexity/i.test(parsed.source)) {
      dropped += 1;
      continue;
    }
    merged.set(rowKey(parsed.symbol, parsed.date), line);
  }

  let added = 0;
  let replaced = 0;
  for (const e of entries) {
    if (!e.symbol || !e.date) continue;
    if (e.date < today) continue;
    const k = rowKey(e.symbol, e.date);
    const newLine = rowFor({ ...e, source: e.source || "Perplexity" }, refreshed);
    if (merged.has(k)) replaced += 1;
    else added += 1;
    merged.set(k, newLine);
  }

  const sorted = Array.from(merged.values()).sort((a, b) => {
    const pa = parseRowLine(a);
    const pb = parseRowLine(b);
    if (!pa || !pb) return 0;
    if (pa.date !== pb.date) return pa.date.localeCompare(pb.date);
    return pa.symbol.localeCompare(pb.symbol);
  });

  const body = `${prelude}\n${HEADER}\n${sorted.join("\n")}\n`;
  await fs.mkdir(path.dirname(FILE), { recursive: true });
  await fs.writeFile(FILE, body, "utf8");

  return { added, replaced, dropped, total: merged.size };
}

async function readFileSafely(): Promise<string> {
  try {
    return await fs.readFile(FILE, "utf8");
  } catch {
    return "";
  }
}

function splitFile(content: string): { prelude: string; oldRows: string[] } {
  if (!content.trim()) {
    const prelude = `# Market Earnings — Upcoming S&P 500 / mega-cap earnings calendar\n\n## Calendar`;
    return { prelude, oldRows: [] };
  }
  const lines = content.split("\n");
  let calendarHeadingIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (/^##\s+Calendar/i.test(lines[i])) {
      calendarHeadingIdx = i;
      break;
    }
  }
  if (calendarHeadingIdx === -1) {
    return { prelude: content.trimEnd() + "\n\n## Calendar", oldRows: [] };
  }
  const prelude = lines.slice(0, calendarHeadingIdx + 1).join("\n");
  const tail = lines.slice(calendarHeadingIdx + 1);
  const oldRows: string[] = [];
  for (const line of tail) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("|")) continue;
    if (/^\|\s*Symbol\s*\|/i.test(trimmed)) continue;
    if (/^\|[\s|:-]+\|$/.test(trimmed)) continue;
    if (/^\|\s*_/.test(trimmed)) continue;
    if (parseRowLine(line)) oldRows.push(line);
  }
  return { prelude, oldRows };
}

function parseRowLine(line: string): {
  symbol: string;
  date: string;
  source: string;
  cells: string[];
} | null {
  const trimmed = line.trim();
  if (!trimmed.startsWith("|")) return null;
  const cells = trimmed.replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim());
  if (cells.length < 4) return null;
  const symbol = cells[0]?.toUpperCase() ?? "";
  const date = cells[2] ?? "";
  const source = cells[5] ?? "";
  if (!symbol) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  return { symbol, date, source, cells };
}

/**
 * NEW 2026-05-06: back-fill `Actual EPS` and `1-day move %` onto existing
 * past-dated rows. The refresh-earnings-results routine calls this once a
 * day; idempotent — re-running with the same payload yields the same file.
 *
 * Only updates rows whose Earnings Date matches an entry. Symbols not in
 * the table are silently skipped (the broader market list may not include
 * every printer).
 */
export async function writeEarningsResults(
  results: Array<{
    symbol: string;
    date: string;
    actualEps?: string;
    postPrintMovePct?: string;
  }>
): Promise<{ updated: number; skipped: number }> {
  const existing = await readFileSafely();
  if (!existing.trim()) return { updated: 0, skipped: results.length };
  const { prelude, oldRows } = splitFile(existing);

  const resultByKey = new Map<
    string,
    { actualEps?: string; postPrintMovePct?: string }
  >();
  for (const r of results) {
    if (!r.symbol || !r.date) continue;
    resultByKey.set(rowKey(r.symbol, r.date), {
      actualEps: r.actualEps,
      postPrintMovePct: r.postPrintMovePct,
    });
  }

  let updated = 0;
  const newLines: string[] = [];
  for (const line of oldRows) {
    const parsed = parseRowLine(line);
    if (!parsed) {
      newLines.push(line);
      continue;
    }
    const k = rowKey(parsed.symbol, parsed.date);
    const result = resultByKey.get(k);
    if (!result) {
      newLines.push(line);
      continue;
    }
    // Pad to at least 8 cells (Symbol..Date refreshed) before appending the
    // two new trailing cells. Old rows from before the schema change have
    // exactly 7 data cells.
    const cells = parsed.cells.slice();
    while (cells.length < 7) cells.push("");
    cells[7] = escapeCell(result.actualEps ?? cells[7] ?? "");
    cells[8] = escapeCell(result.postPrintMovePct ?? cells[8] ?? "");
    const rebuilt = "| " + cells.join(" | ") + " |";
    if (rebuilt !== line) updated += 1;
    newLines.push(rebuilt);
  }

  newLines.sort((a, b) => {
    const pa = parseRowLine(a);
    const pb = parseRowLine(b);
    if (!pa || !pb) return 0;
    if (pa.date !== pb.date) return pa.date.localeCompare(pb.date);
    return pa.symbol.localeCompare(pb.symbol);
  });

  const body = `${prelude}\n${HEADER}\n${newLines.join("\n")}\n`;
  await fs.mkdir(path.dirname(FILE), { recursive: true });
  await fs.writeFile(FILE, body, "utf8");

  return { updated, skipped: results.length - updated };
}
