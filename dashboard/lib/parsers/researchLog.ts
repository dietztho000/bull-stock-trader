import { readMemory, type MemoryCtx } from "../memoryPath";

export type ResearchEntry = {
  date: string;
  /** The section title after the date — e.g. "Pre-market Research",
   *  "Midday Addendum", "Research". Lets the UI distinguish entry types
   *  when a single trading day has multiple sections (pre-market plus
   *  later addenda from mid-morning / midday / etc.). */
  label: string;
  decision: string | null;
  ideas: string[];
  body: string;
};

export async function loadResearchLog(ctx: MemoryCtx): Promise<ResearchEntry[]> {
  const content = await readMemory("RESEARCH-LOG.md", ctx);
  const lines = content.split("\n");
  const entries: ResearchEntry[] = [];
  let cur: { date: string; label: string; body: string[] } | null = null;
  for (const l of lines) {
    // Match any dated section heading: `## YYYY-MM-DD — <label>`. Label is
    // captured so the UI can show "Midday Addendum" vs "Pre-market
    // Research" — earlier versions of this parser only matched the
    // pre-market heading and silently dropped midday/late-morning addenda.
    const m = l.match(/^##\s+(\d{4}-\d{2}-\d{2})\s+—\s+(.+?)\s*$/);
    if (m) {
      if (cur) entries.push(parseEntry(cur));
      cur = { date: m[1], label: m[2].trim(), body: [] };
    } else if (cur) {
      cur.body.push(l);
    }
  }
  if (cur) entries.push(parseEntry(cur));
  // Newest date first; same-date sections stay in file (chronological)
  // order via the stable sort guaranteed by V8's Timsort.
  entries.sort((a, b) => b.date.localeCompare(a.date));
  return entries;
}

function parseEntry(c: { date: string; label: string; body: string[] }): ResearchEntry {
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
    label: c.label,
    decision: decisionMatch?.[1] ?? null,
    ideas,
    body: body.trim(),
  };
}
