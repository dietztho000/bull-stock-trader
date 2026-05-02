import { readMemory } from "../memoryPath";
import { parseMdTable } from "./parseMdTable";
import { isPlaceholder } from "./numbers";
import type { EarningsEntry } from "./earningsCalendar.shared";

export type { EarningsEntry } from "./earningsCalendar.shared";
export { daysUntilEarnings } from "./earningsCalendar.shared";

export async function loadEarningsCalendar(): Promise<Map<string, EarningsEntry>> {
  const content = await readMemory("EARNINGS-CALENDAR.md");
  const rows = parseMdTable(content, { heading: /^##\s+Calendar/i }).filter(
    (r) => !isPlaceholder(r) && r["Symbol"]
  );
  const m = new Map<string, EarningsEntry>();
  for (const r of rows) {
    const symbol = r["Symbol"]?.toUpperCase();
    if (!symbol) continue;
    const t = (r["BMO/AMC"] ?? "").toUpperCase();
    m.set(symbol, {
      symbol,
      date: r["Next Earnings Date"] ?? "",
      type: t === "BMO" || t === "AMC" ? t : "",
      source: r["Source"] ?? "",
      refreshed: r["Date refreshed"] ?? "",
    });
  }
  return m;
}
