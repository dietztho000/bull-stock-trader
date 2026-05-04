import { readMemory, type MemoryCtx } from "../memoryPath";

export type WeeklyReview = {
  weekEnding: string;
  body: string;
  stats: Record<string, string>;
  grade: string | null;
};

export async function loadWeeklyReviews(ctx: MemoryCtx): Promise<WeeklyReview[]> {
  const content = await readMemory("WEEKLY-REVIEW.md", ctx);
  const lines = content.split("\n");
  const out: WeeklyReview[] = [];
  let cur: { weekEnding: string; body: string[] } | null = null;
  for (const l of lines) {
    const m = l.match(/^##\s+Week ending\s+(\d{4}-\d{2}-\d{2})/i);
    if (m) {
      if (cur) out.push(parse(cur));
      cur = { weekEnding: m[1], body: [] };
    } else if (cur) {
      cur.body.push(l);
    }
  }
  if (cur) out.push(parse(cur));
  out.sort((a, b) => b.weekEnding.localeCompare(a.weekEnding));
  return out;
}

function parse(c: { weekEnding: string; body: string[] }): WeeklyReview {
  const body = c.body.join("\n");
  const stats: Record<string, string> = {};
  const statsSection = body.match(/###\s+Stats([\s\S]*?)(?=\n###\s|\n##\s|$)/i);
  if (statsSection) {
    for (const line of statsSection[1].split("\n")) {
      if (!line.trim().startsWith("|")) continue;
      const cells = line
        .trim()
        .replace(/^\|/, "")
        .replace(/\|$/, "")
        .split("|")
        .map((c) => c.trim());
      if (cells.length < 2) continue;
      if (/^-+$/.test(cells[0])) continue;
      if (/^Metric$/i.test(cells[0])) continue;
      if (cells[0]) stats[cells[0]] = cells[1];
    }
  }
  const gradeMatch = body.match(/###\s+Overall Grade:\s*([A-F][+-]?)/i);
  return {
    weekEnding: c.weekEnding,
    body: body.trim(),
    stats,
    grade: gradeMatch?.[1] ?? null,
  };
}
