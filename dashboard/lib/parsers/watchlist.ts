// NEW 2026-05-06: shared watchlist for the calendar page. Calendar shows
// a star icon next to watchlisted symbols; the refresh-market-earnings
// routine appends watchlist symbols onto MARKET_EARNINGS_TICKERS at run
// time so any starred ticker auto-appears on the calendar even if it's
// not in the curated mega-cap list.
//
// File format mirrors the other shared markdown tables (SECTOR-MAP, etc.):
//
//   # Watchlist — symbols starred from the dashboard /calendar page
//
//   ## List
//   | Symbol | Note | Added |
//   |--------|------|-------|
//   | AAPL   |      | 2026-05-06 |
//
// This file imports `node:fs` directly because it is a writer (mirrors
// `marketEarningsWriter.ts` and `economicCalendarWriter.ts`); see the
// allow-list in `parsersUseRegistry.test.ts`. The reader path uses
// `readMemory()` per the registry contract.

import path from "node:path";
import fs from "node:fs/promises";
import { readMemory, resolveMemoryFile } from "../memoryPath";
import { parseMdTable } from "./parseMdTable";
import { isPlaceholder } from "./numbers";

export type WatchlistEntry = {
  symbol: string;
  note: string;
  added: string;
};

const FILE = resolveMemoryFile("WATCHLIST.md");

const HEADER = `| Symbol | Note | Added |\n|--------|------|-------|`;

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function escapeCell(s: string): string {
  return s.replace(/\|/g, "\\|").trim();
}

export async function loadWatchlist(): Promise<WatchlistEntry[]> {
  const content = await readMemory("WATCHLIST.md");
  const rows = parseMdTable(content, { heading: /^##\s+List/i }).filter(
    (r) => !isPlaceholder(r) && r["Symbol"]
  );
  const out: WatchlistEntry[] = [];
  for (const r of rows) {
    const sym = r["Symbol"]?.toUpperCase().trim();
    if (!sym) continue;
    out.push({
      symbol: sym,
      note: r["Note"] ?? "",
      added: r["Added"] ?? "",
    });
  }
  out.sort((a, b) => a.symbol.localeCompare(b.symbol));
  return out;
}

export async function loadWatchlistSymbols(): Promise<Set<string>> {
  const entries = await loadWatchlist();
  return new Set(entries.map((e) => e.symbol));
}

async function readFileSafely(): Promise<string> {
  try {
    return await fs.readFile(FILE, "utf8");
  } catch {
    return "";
  }
}

function buildBody(entries: WatchlistEntry[]): string {
  const sorted = entries
    .slice()
    .sort((a, b) => a.symbol.localeCompare(b.symbol));
  const lines = sorted.map(
    (e) =>
      `| ${e.symbol.toUpperCase()} | ${escapeCell(e.note)} | ${e.added || ""} |`
  );
  const prelude = "# Watchlist — symbols starred from /calendar\n\n## List";
  return `${prelude}\n${HEADER}\n${lines.join("\n")}\n`;
}

/** Idempotent — adding an existing symbol is a no-op (note + added preserved). */
export async function addToWatchlist(
  symbol: string,
  note: string = ""
): Promise<{ added: boolean; entry: WatchlistEntry }> {
  const sym = symbol.toUpperCase().trim();
  if (!/^[A-Z][A-Z0-9.\-]*$/.test(sym)) {
    throw new Error(`invalid symbol: ${symbol}`);
  }
  const existing = await loadWatchlist();
  const found = existing.find((e) => e.symbol === sym);
  if (found) {
    return { added: false, entry: found };
  }
  const entry: WatchlistEntry = { symbol: sym, note, added: todayIso() };
  const next = [...existing, entry];
  await fs.mkdir(path.dirname(FILE), { recursive: true });
  await fs.writeFile(FILE, buildBody(next), "utf8");
  return { added: true, entry };
}

export async function removeFromWatchlist(
  symbol: string
): Promise<{ removed: boolean }> {
  const sym = symbol.toUpperCase().trim();
  const existing = await loadWatchlist();
  const next = existing.filter((e) => e.symbol !== sym);
  if (next.length === existing.length) return { removed: false };
  await fs.mkdir(path.dirname(FILE), { recursive: true });
  await fs.writeFile(FILE, buildBody(next), "utf8");
  return { removed: true };
}

export async function _seedIfMissing(): Promise<void> {
  const content = await readFileSafely();
  if (content.trim()) return;
  await fs.mkdir(path.dirname(FILE), { recursive: true });
  await fs.writeFile(FILE, buildBody([]), "utf8");
}
