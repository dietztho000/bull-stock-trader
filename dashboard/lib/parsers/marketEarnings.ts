import { readMemory } from "../memoryPath";
import { parseMdTable } from "./parseMdTable";
import { isPlaceholder } from "./numbers";
import type { EarningsEntry } from "./earningsCalendar.shared";

export async function loadMarketEarnings(): Promise<EarningsEntry[]> {
  const content = await readMemory("MARKET-EARNINGS.md");
  const rows = parseMdTable(content, { heading: /^##\s+Calendar/i }).filter(
    (r) => !isPlaceholder(r) && r["Symbol"] && r["Earnings Date"]
  );
  const out: EarningsEntry[] = [];
  for (const r of rows) {
    const symbol = r["Symbol"]?.toUpperCase();
    const date = r["Earnings Date"];
    if (!symbol || !/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
    const t = (r["BMO/AMC"] ?? "").toUpperCase();
    out.push({
      symbol,
      date,
      type: t === "BMO" || t === "AMC" ? t : "",
      source: r["Source"] ?? "",
      refreshed: r["Date refreshed"] ?? "",
      company: r["Company"] || undefined,
      epsEstimate: r["EPS Estimate"] || undefined,
    });
  }
  out.sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    return a.symbol.localeCompare(b.symbol);
  });
  return out;
}
