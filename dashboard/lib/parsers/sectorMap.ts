import { readMemory } from "../memoryPath";
import { parseMdTable } from "./parseMdTable";
import { isPlaceholder } from "./numbers";

export type SectorMapEntry = {
  symbol: string;
  sector: string;
  source: string;
  dateAdded: string;
};

export async function loadSectorMap(): Promise<Map<string, string>> {
  const content = await readMemory("SECTOR-MAP.md");
  const rows = parseMdTable(content, { heading: /^##\s+Map/i }).filter(
    (r) => !isPlaceholder(r) && r["Symbol"]
  );
  const m = new Map<string, string>();
  for (const r of rows) {
    if (r["Symbol"]) m.set(r["Symbol"].toUpperCase(), r["Sector"] ?? "");
  }
  return m;
}
