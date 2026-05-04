import { readMemory, type MemoryCtx } from "../memoryPath";
import { parseMoney, parsePercent } from "./numbers";

export type EntryScorer = {
  catalyst?: number;
  momentum?: number;
  risk_reward?: number;
  stop_distance?: number;
  total?: number;
};

export type EodPosition = {
  ticker: string;
  shares: number | null;
  entry: number | null;
  close: number | null;
  dayChange: number | null;
  unrealizedPnl: number | null;
  unrealizedPct: number | null;
  stop: number | null;
};

export type EodSnapshot = {
  day: number | null;
  date: string | null;
  weekday: string | null;
  portfolio: number | null;
  cash: number | null;
  cashPct: number | null;
  dayPnl: number | null;
  dayPct: number | null;
  phasePnl: number | null;
  phasePct: number | null;
  vsSpyDay: number | null;
  vsSpyPhase: number | null;
  positions: EodPosition[];
  notes: string;
  raw: string;
};

export type TradeEntry = {
  date: string | null;
  ticker: string;
  side: "buy" | "sell" | string;
  shares: number | null;
  entry: number | null;
  stop: number | null;
  target: number | null;
  rr: number | null;
  thesis: string;
  sector: string;
  scorer: EntryScorer | null;
  raw: string;
};

export type TradeLogData = {
  snapshots: EodSnapshot[];
  entries: TradeEntry[];
};

function parseEodHeader(line: string) {
  // ### Day 5 — EOD Snapshot — 2026-05-04 (Monday)
  // OR ### MMM DD — EOD Snapshot (Day N, Weekday)
  const dayMatch = line.match(/Day\s+(\d+)/i);
  const isoMatch = line.match(/(\d{4}-\d{2}-\d{2})/);
  const weekdayMatch = line.match(
    /(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)/i
  );
  return {
    day: dayMatch ? Number(dayMatch[1]) : null,
    date: isoMatch ? isoMatch[1] : null,
    weekday: weekdayMatch ? weekdayMatch[1] : null,
  };
}

function parseKpiLine(line: string) {
  const get = (label: RegExp) =>
    line.match(label)?.[1]?.trim() ?? undefined;
  return {
    portfolio: parseMoney(get(/Portfolio:\s*([^|]+?)(?:\s*\||$)/i)),
    cash: parseMoney(get(/Cash:\s*([^()|]+?)(?:\s*\(|\s*\||$)/i)),
    cashPct: parsePercent(get(/Cash:[^(]*\(([^)]+)\)/i)),
    dayPnl: parseMoney(get(/Day P&L:\s*([^()|]+?)(?:\s*\(|\s*\||$)/i)),
    dayPct: parsePercent(get(/Day P&L:[^(]*\(([^)]+)\)/i)),
    phasePnl: parseMoney(get(/Phase P&L:\s*([^()|]+?)(?:\s*\(|\s*\||$)/i)),
    phasePct: parsePercent(get(/Phase P&L:[^(]*\(([^)]+)\)/i)),
  };
}

function parseVsSpy(line: string) {
  return {
    vsSpyDay: parsePercent(line.match(/day\s*([+-]?[\d.]+%)/i)?.[1]),
    vsSpyPhase: parsePercent(line.match(/phase\s*([+-]?[\d.]+%)/i)?.[1]),
  };
}

function parsePositionsTable(block: string): EodPosition[] {
  const lines = block.split("\n").filter((l) => l.trim().startsWith("|"));
  if (lines.length < 2) return [];
  const positions: EodPosition[] = [];
  for (let i = 2; i < lines.length; i++) {
    const cells = lines[i]
      .trim()
      .replace(/^\|/, "")
      .replace(/\|$/, "")
      .split("|")
      .map((c) => c.trim());
    if (cells.length < 7) continue;
    const [ticker, shares, entry, close, dayChg, pnlCell, stop] = cells;
    if (!ticker || /^_.+_$/.test(ticker)) continue;
    const pnlMatch = pnlCell.match(/([+-]?[\d.,$]+)\s*\(([^)]+)\)/);
    positions.push({
      ticker,
      shares: parseMoney(shares),
      entry: parseMoney(entry),
      close: parseMoney(close),
      dayChange: parseMoney(dayChg),
      unrealizedPnl: pnlMatch ? parseMoney(pnlMatch[1]) : parseMoney(pnlCell),
      unrealizedPct: pnlMatch ? parsePercent(pnlMatch[2]) : null,
      stop: parseMoney(stop),
    });
  }
  return positions;
}

function parseSnapshot(block: string): EodSnapshot {
  const lines = block.split("\n");
  const headerLine = lines[0] ?? "";
  const { day, date, weekday } = parseEodHeader(headerLine);

  let portfolio: number | null = null,
    cash: number | null = null,
    cashPct: number | null = null,
    dayPnl: number | null = null,
    dayPct: number | null = null,
    phasePnl: number | null = null,
    phasePct: number | null = null,
    vsSpyDay: number | null = null,
    vsSpyPhase: number | null = null;

  let tableStart = -1;
  let notesStart = -1;
  for (let i = 1; i < lines.length; i++) {
    const l = lines[i];
    if (/Portfolio:/i.test(l) && /P&L/i.test(l)) {
      const k = parseKpiLine(l);
      portfolio = k.portfolio;
      cash = k.cash;
      cashPct = k.cashPct;
      dayPnl = k.dayPnl;
      dayPct = k.dayPct;
      phasePnl = k.phasePnl;
      phasePct = k.phasePct;
    } else if (/vs SPY/i.test(l)) {
      const v = parseVsSpy(l);
      vsSpyDay = v.vsSpyDay;
      vsSpyPhase = v.vsSpyPhase;
    } else if (l.trim().startsWith("|") && tableStart === -1) {
      tableStart = i;
    } else if (/\*\*Notes:\*\*/i.test(l) || /^Notes:/i.test(l)) {
      notesStart = i;
      break;
    }
  }

  const tableEnd =
    notesStart > -1
      ? notesStart
      : lines.findIndex(
          (l, i) => i > tableStart && tableStart > -1 && !l.trim().startsWith("|")
        );
  const tableBlock =
    tableStart > -1
      ? lines.slice(tableStart, tableEnd > -1 ? tableEnd : undefined).join("\n")
      : "";
  const positions = tableBlock ? parsePositionsTable(tableBlock) : [];

  const notes = notesStart > -1
    ? lines.slice(notesStart).join("\n").replace(/\*\*Notes:\*\*\s*/i, "").trim()
    : "";

  return {
    day,
    date,
    weekday,
    portfolio,
    cash,
    cashPct,
    dayPnl,
    dayPct,
    phasePnl,
    phasePct,
    vsSpyDay,
    vsSpyPhase,
    positions,
    notes,
    raw: block,
  };
}

function splitSnapshots(content: string): string[] {
  // Snapshots start with `## Day` or `### Day` or similar.
  const lines = content.split("\n");
  const blocks: string[] = [];
  let cur: string[] = [];
  for (const l of lines) {
    if (/^#{2,3}\s+(Day\s+\d+|[A-Z][a-z]{2}\s+\d+)\s+—\s+EOD/i.test(l) ||
        /^#{2,3}\s+Day\s+\d+\s+—\s+EOD/i.test(l)) {
      if (cur.length) blocks.push(cur.join("\n"));
      cur = [l];
    } else if (cur.length) {
      // stop block when next top-level heading not part of snapshot
      if (/^##?\s+[A-Z]/.test(l) && !/EOD/.test(l) && !/Trades:/.test(l)) {
        blocks.push(cur.join("\n"));
        cur = [];
        continue;
      }
      cur.push(l);
    }
  }
  if (cur.length) blocks.push(cur.join("\n"));
  return blocks;
}

function parseEntries(content: string): TradeEntry[] {
  // Trade entries appear as "## Trades:" sections or table rows. Bot uses
  // a flexible format. We look for `entry_scorer:` JSON lines and walk
  // back/forward to gather the surrounding trade record.
  const lines = content.split("\n");
  const entries: TradeEntry[] = [];

  // Strategy 1: entry_scorer JSON blocks (always emitted per trade).
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^entry_scorer:\s*(\{.+\})\s*$/);
    if (!m) continue;
    let scorer: EntryScorer | null = null;
    try {
      scorer = JSON.parse(m[1]);
    } catch {
      scorer = null;
    }
    // surrounding context: look back up to 6 lines for ticker/side info
    const contextStart = Math.max(0, i - 6);
    const contextEnd = Math.min(lines.length, i + 1);
    const ctx = lines.slice(contextStart, contextEnd).join("\n");
    const tickerMatch = ctx.match(/\b([A-Z]{1,5})\b\s*\|\s*(buy|sell)/i) ||
                        ctx.match(/Ticker[:\s]+([A-Z]{1,5})/i);
    const dateMatch = ctx.match(/(\d{4}-\d{2}-\d{2})/);
    const sideMatch = ctx.match(/\b(buy|sell)\b/i);
    const sharesMatch = ctx.match(/(\d+)\s+shares?/i) ||
                        ctx.match(/\|\s*(\d+)\s*\|/);
    const entryMatch = ctx.match(/Entry[:\s]+\$?([\d.,]+)/i);
    const stopMatch = ctx.match(/Stop[:\s]+\$?([\d.,]+)/i);
    const targetMatch = ctx.match(/Target[:\s]+\$?([\d.,]+)/i);
    const rrMatch = ctx.match(/R:R[:\s]+([\d.]+)/i);
    const sectorMatch = ctx.match(/Sector[:\s]+([A-Za-z &]+)/i);
    const thesisMatch = ctx.match(/Thesis[:\s]+([^\n]+)/i);

    entries.push({
      date: dateMatch?.[1] ?? null,
      ticker: tickerMatch?.[1] ?? "?",
      side: (sideMatch?.[1] ?? "buy").toLowerCase(),
      shares: sharesMatch ? Number(sharesMatch[1]) : null,
      entry: parseMoney(entryMatch?.[1]),
      stop: parseMoney(stopMatch?.[1]),
      target: parseMoney(targetMatch?.[1]),
      rr: rrMatch ? Number(rrMatch[1]) : null,
      thesis: thesisMatch?.[1]?.trim() ?? "",
      sector: sectorMatch?.[1]?.trim() ?? "",
      scorer,
      raw: ctx,
    });
  }
  return entries;
}

export async function loadTradeLog(memCtx: MemoryCtx): Promise<TradeLogData> {
  const content = await readMemory("TRADE-LOG.md", memCtx);
  const blocks = splitSnapshots(content);
  const snapshots = blocks
    .map(parseSnapshot)
    .filter((s) => s.portfolio !== null || s.day !== null);
  const entries = parseEntries(content);
  // sort snapshots by day asc
  snapshots.sort((a, b) => (a.day ?? 0) - (b.day ?? 0));
  return { snapshots, entries };
}
