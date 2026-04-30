// Parse "$10,500.00" → 10500, "+5.0%" → 5.0, "—" or "TBD" → null.

export function parseMoney(s: string | undefined | null): number | null {
  if (!s) return null;
  const cleaned = s.replace(/[$,\s]/g, "").replace(/^\+/, "");
  if (!cleaned || /^(tbd|—|-|n\/a)$/i.test(cleaned)) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

export function parsePercent(s: string | undefined | null): number | null {
  if (!s) return null;
  const m = s.replace(/\s/g, "").match(/^([+-]?\d+(?:\.\d+)?)\s*%?$/);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : null;
}

export function parseInt0(s: string | undefined | null): number | null {
  if (!s) return null;
  const n = parseInt(s.replace(/[,\s]/g, ""), 10);
  return Number.isFinite(n) ? n : null;
}

export function isPlaceholder(row: Record<string, string>): boolean {
  return Object.values(row).some((v) => /^_.+_$/.test(v.trim()));
}
