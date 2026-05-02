import { readMemory } from "../memoryPath";
import { parseMdTable } from "./parseMdTable";
import { isPlaceholder } from "./numbers";
import {
  type EconomicEvent,
  normalizeImportance,
} from "./economicCalendar.shared";

export type { EconomicEvent, EconomicImportance } from "./economicCalendar.shared";
export { daysUntilEvent, normalizeImportance } from "./economicCalendar.shared";

export async function loadEconomicCalendar(): Promise<EconomicEvent[]> {
  const content = await readMemory("ECONOMIC-CALENDAR.md");
  const rows = parseMdTable(content, { heading: /^##\s+Calendar/i }).filter(
    (r) => !isPlaceholder(r) && r["Date"] && r["Event"]
  );
  const events: EconomicEvent[] = [];
  for (const r of rows) {
    const date = r["Date"];
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
    events.push({
      date,
      time: r["Time (ET)"] ?? "",
      event: r["Event"] ?? "",
      importance: normalizeImportance(r["Importance"] ?? ""),
      forecast: r["Forecast"] ?? "",
      previous: r["Previous"] ?? "",
      source: r["Source"] ?? "",
      refreshed: r["Date refreshed"] ?? "",
    });
  }
  events.sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    return a.time.localeCompare(b.time);
  });
  return events;
}
