// Generic markdown pipe-table parser.
// Extracts the FIRST pipe table after `headingRegex` (or the first table in
// the file if no heading is given). Returns rows as { columnName: cellValue }.

export type TableRow = Record<string, string>;

export function findSection(content: string, heading: RegExp): string {
  const lines = content.split("\n");
  let start = -1;
  for (let i = 0; i < lines.length; i++) {
    if (heading.test(lines[i])) {
      start = i + 1;
      break;
    }
  }
  if (start === -1) return "";
  let end = lines.length;
  const level = lines[start - 1].match(/^#+/)?.[0].length ?? 0;
  for (let i = start; i < lines.length; i++) {
    const m = lines[i].match(/^(#+)\s/);
    if (m && m[1].length <= level) {
      end = i;
      break;
    }
  }
  return lines.slice(start, end).join("\n");
}

function splitRow(line: string): string[] {
  // strip leading/trailing pipes, then split.
  const trimmed = line.trim().replace(/^\|/, "").replace(/\|$/, "");
  return trimmed.split("|").map((c) => c.trim());
}

export function parseMdTable(
  content: string,
  opts: { heading?: RegExp } = {}
): TableRow[] {
  const region = opts.heading ? findSection(content, opts.heading) : content;
  if (!region.trim()) return [];

  const lines = region.split("\n");
  let headerIdx = -1;
  for (let i = 0; i < lines.length - 1; i++) {
    const l = lines[i].trim();
    const sep = lines[i + 1]?.trim() ?? "";
    if (
      l.startsWith("|") &&
      l.includes("|") &&
      /^\|?\s*:?-{2,}/.test(sep)
    ) {
      headerIdx = i;
      break;
    }
  }
  if (headerIdx === -1) return [];

  const headers = splitRow(lines[headerIdx]);
  const rows: TableRow[] = [];
  for (let i = headerIdx + 2; i < lines.length; i++) {
    const l = lines[i].trim();
    if (!l) break; // blank line ends the table
    if (!l.startsWith("|")) break;
    const cells = splitRow(l);
    const row: TableRow = {};
    headers.forEach((h, idx) => (row[h] = cells[idx] ?? ""));
    rows.push(row);
  }
  return rows;
}
