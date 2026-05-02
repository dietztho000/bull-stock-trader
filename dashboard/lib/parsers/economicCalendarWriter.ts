import path from "node:path";
import fs from "node:fs/promises";
import { MEMORY_DIR } from "../memoryPath";
import type { EconomicEvent } from "./economicCalendar.shared";

const FILE = path.join(MEMORY_DIR, "ECONOMIC-CALENDAR.md");

const HEADER = `| Date | Time (ET) | Event | Importance | Forecast | Previous | Source | Date refreshed |\n|------|-----------|-------|------------|----------|----------|--------|----------------|`;

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function rowKey(date: string, event: string): string {
  return `${date}::${event.trim().toLowerCase()}`;
}

function escapeCell(s: string): string {
  return s.replace(/\|/g, "\\|").trim();
}

function rowFor(e: EconomicEvent, refreshed: string): string {
  return [
    "",
    e.date,
    e.time,
    escapeCell(e.event),
    e.importance,
    escapeCell(e.forecast),
    escapeCell(e.previous),
    escapeCell(e.source || "Perplexity"),
    refreshed,
    "",
  ].join(" | ").trim().replace(/^\| /, "| ");
}

/**
 * Idempotent refresh:
 * - Drop all `Perplexity`-sourced rows whose Date is in the future.
 *   (Perplexity event-name wording drifts between calls, so date+name
 *    isn't a stable identity. Wholesale-replacing the model's prior
 *    output keeps the table from accumulating duplicate variants.)
 * - Preserve any non-Perplexity rows (e.g. Source = "manual" or "WebSearch")
 *   that the user / fallback path inserted.
 * - Drop rows whose Date is before today (housekeeping).
 * - Insert all incoming events.
 *
 * Preserves the file's prose / heading; only the ## Calendar table changes.
 */
export async function writeEconomicCalendar(
  events: EconomicEvent[],
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
    merged.set(rowKey(parsed.date, parsed.event), line);
  }

  let added = 0;
  let replaced = 0;
  for (const e of events) {
    if (!e.date || !e.event) continue;
    if (e.date < today) continue;
    const k = rowKey(e.date, e.event);
    const newLine = rowFor({ ...e, source: e.source || "Perplexity" }, refreshed);
    if (merged.has(k)) replaced += 1;
    else added += 1;
    merged.set(k, newLine);
  }

  // Sort merged rows by date+time.
  const sorted = Array.from(merged.values()).sort((a, b) => {
    const pa = parseRowLine(a);
    const pb = parseRowLine(b);
    if (!pa || !pb) return 0;
    if (pa.date !== pb.date) return pa.date.localeCompare(pb.date);
    return pa.time.localeCompare(pb.time);
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
    const prelude = `# Economic Calendar — Cached upcoming US economic events\n\n## Calendar`;
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
    if (/^\|\s*Date\s*\|/i.test(trimmed)) continue;
    if (/^\|[\s|:-]+\|$/.test(trimmed)) continue;
    if (/^\|\s*_/.test(trimmed)) continue;
    if (parseRowLine(line)) oldRows.push(line);
  }
  return { prelude, oldRows };
}

function parseRowLine(line: string): {
  date: string;
  time: string;
  event: string;
  source: string;
} | null {
  const trimmed = line.trim();
  if (!trimmed.startsWith("|")) return null;
  const cells = trimmed.replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim());
  if (cells.length < 3) return null;
  const date = cells[0];
  const time = cells[1];
  const event = cells[2];
  const source = cells[6] ?? "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  if (!event) return null;
  return { date, time, event, source };
}
