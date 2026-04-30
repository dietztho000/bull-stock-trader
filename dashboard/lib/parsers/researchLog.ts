import { readMemory } from "../memoryPath";

export type ResearchEntry = {
  date: string;
  decision: string | null;
  ideas: string[];
  body: string;
};

export async function loadResearchLog(): Promise<ResearchEntry[]> {
  const content = await readMemory("RESEARCH-LOG.md");
  const lines = content.split("\n");
  const entries: ResearchEntry[] = [];
  let cur: { date: string; body: string[] } | null = null;
  for (const l of lines) {
    const m = l.match(
      /^##\s+(\d{4}-\d{2}-\d{2})\s+—\s+(?:Pre-market\s+)?Research/i
    );
    if (m) {
      if (cur) entries.push(parseEntry(cur));
      cur = { date: m[1], body: [] };
    } else if (cur) {
      cur.body.push(l);
    }
  }
  if (cur) entries.push(parseEntry(cur));
  entries.sort((a, b) => b.date.localeCompare(a.date));
  return entries;
}

function parseEntry(c: { date: string; body: string[] }): ResearchEntry {
  const body = c.body.join("\n");
  const decisionMatch = body.match(
    /###\s+Decision\s*\n+\s*([A-Z]+(?:\s*\([^)]*\))?)/i
  );
  const ideasSection = body.match(/###\s+Trade Ideas([\s\S]*?)(?=\n###\s|\n##\s|$)/i);
  const ideas: string[] = [];
  if (ideasSection) {
    for (const line of ideasSection[1].split("\n")) {
      const m = line.match(/^\s*\d+\.\s+(.+\S)/);
      if (m) ideas.push(m[1].trim());
    }
  }
  return {
    date: c.date,
    decision: decisionMatch?.[1] ?? null,
    ideas,
    body: body.trim(),
  };
}
