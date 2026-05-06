import { readMemory } from "../memoryPath";

/** DAILY-SUMMARY.md is a `shared`-scoped file (see `MEMORY_FILE_SCOPE` in
 *  lib/memoryPath.ts) — every bot writes a dated section into the same
 *  cross-bot file rather than a per-bot copy. That's why this loader takes
 *  no `MemoryCtx`: the resolver in `readMemory` ignores ctx for shared
 *  files and walks straight to `memory/shared/DAILY-SUMMARY.md`. If a
 *  future change scopes daily summaries per-bot, this signature must add
 *  `ctx: MemoryCtx` and the registry entry must flip to `per-bot`. */

export type DailySummaryEntry = {
  timestamp: string;
  date: string | null;
  note: string | null;
  body: string;
};

export async function loadDailySummaries(): Promise<DailySummaryEntry[]> {
  const raw = await readMemory("DAILY-SUMMARY.md");
  if (!raw) return [];

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
