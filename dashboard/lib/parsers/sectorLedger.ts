import { readMemory, type MemoryCtx } from "../memoryPath";
import { parseMdTable } from "./parseMdTable";
import { parseMoney, parsePercent, isPlaceholder } from "./numbers";

export type ClosedTrade = {
  date: string;
  symbol: string;
  sector: string;
  side: "buy" | "sell" | string;
  entry: number | null;
  exit: number | null;
  pnl: number | null;
  pnlPct: number | null;
  outcome: "W" | "L" | "B" | string;
  notes: string;
};

export type SectorStreak = {
  sector: string;
  lastTwo: string;
  streak: string;
  status: "OPEN" | "BLOCKED" | string;
};

export type SectorLedger = {
  closed: ClosedTrade[];
  streaks: SectorStreak[];
};

export async function loadSectorLedger(ctx: MemoryCtx): Promise<SectorLedger> {
  const content = await readMemory("SECTOR-LEDGER.md", ctx);

  const closedRows = parseMdTable(content, {
    heading: /^##\s+Closed trades/i,
  })
    .filter((r) => !isPlaceholder(r) && r["Symbol"])
    .map<ClosedTrade>((r) => ({
      date: r["Date"] ?? "",
      symbol: r["Symbol"] ?? "",
      sector: r["Sector"] ?? "",
      side: (r["Side"] ?? "").toLowerCase(),
      entry: parseMoney(r["Entry"]),
      exit: parseMoney(r["Exit"]),
      pnl: parseMoney(r["P&L $"] ?? r["PnL $"] ?? r["P&L"]),
      pnlPct: parsePercent(r["P&L %"] ?? r["PnL %"]),
      outcome: (r["Outcome"] ?? "").toUpperCase(),
      notes: r["Notes"] ?? "",
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const streaks = parseMdTable(content, {
    heading: /^##\s+Streak tracker/i,
  })
    .filter((r) => !isPlaceholder(r) && r["Sector"])
    .map<SectorStreak>((r) => ({
      sector: r["Sector"] ?? "",
      lastTwo: r["Last 2 outcomes"] ?? r["Last 2"] ?? "",
      streak: r["30-day streak"] ?? r["Streak"] ?? "",
      status: (r["Status"] ?? "OPEN").toUpperCase(),
    }));

  return { closed: closedRows, streaks };
}
