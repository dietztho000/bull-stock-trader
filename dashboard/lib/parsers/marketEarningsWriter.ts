import path from "node:path";
import fs from "node:fs/promises";
import { MEMORY_DIR } from "../memoryPath";
import type { EarningsEntry } from "./earningsCalendar.shared";

const FILE = path.join(MEMORY_DIR, "MARKET-EARNINGS.md");

const HEADER = `| Symbol | Company | Earnings Date | BMO/AMC | EPS Estimate | Source | Date refreshed |\n|--------|---------|---------------|---------|--------------|--------|----------------|`;

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
  const merged = new Map<string, string>();
  let dropped = 0;

  for (const line of oldRows) {
    const parsed = parseRowLine(line);
    if (!parsed) continue;
    if (parsed.date < today) {
      dropped += 1;
      continue;
    }
    if (/perplexity/i.test(parsed.source)) {
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
  return { symbol, date, source };
}
