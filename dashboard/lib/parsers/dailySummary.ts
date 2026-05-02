import fs from "node:fs/promises";
import path from "node:path";
import { BOT_ROOT } from "../memoryPath";

export type DailySummaryEntry = {
  timestamp: string;
  date: string | null;
  note: string | null;
  body: string;
};

export async function loadDailySummaries(): Promise<DailySummaryEntry[]> {
  const filePath = path.join(BOT_ROOT, "DAILY-SUMMARY.md");
  let raw = "";
  try {
    raw = await fs.readFile(filePath, "utf8");
  } catch {
    return [];
  }
  const sections = raw
    .split(/\n?---\n/g)
    .map((s) => s.trim())
    .filter(Boolean);

  const out: DailySummaryEntry[] = [];
  for (const section of sections) {
    const lines = section.split("\n");
    const headerIdx = lines.findIndex((l) => /^##\s+/.test(l));
    if (headerIdx < 0) continue;
    const header = lines[headerIdx].replace(/^##\s+/, "").trim();
    const headerMatch = header.match(/^(\d{4}-\d{2}-\d{2})(?:\s+\S+)?(?:\s+\S+)?(?:\s+\((.+)\))?/);
    const date = headerMatch?.[1] ?? null;
    const note = headerMatch?.[2] ?? null;
    const body = lines.slice(headerIdx + 1).join("\n").trim();
    out.push({ timestamp: header, date, note, body });
  }
  out.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  return out;
}
