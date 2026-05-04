import { readMemory, type MemoryCtx } from "../memoryPath";

export type LadderState = {
  symbol: string;
  rungFiredAt: string;     // YYYY-MM-DD HH:MM
  firedAtPct: number;      // e.g., 22.3
};

// Parses TRADE-LOG.md for `take-profit-50: fired YYYY-MM-DD HH:MM at +X.X%`
// annotations. The bot writes one per position the first time the +20%
// rung trips; the same line is the idempotency anchor (subsequent routine
// runs skip if it exists).
//
// The annotation lives inside a `### MMM DD HH:MM — Take-profit ladder`
// section that includes a `- SYM: rung-1 fired @+X.X%` bullet — we use
// either marker but prefer the explicit `take-profit-50:` line because
// the bot is required to write it (idempotency check depends on it).
export async function loadLadderProgress(ctx: MemoryCtx): Promise<Map<string, LadderState>> {
  const content = await readMemory("TRADE-LOG.md", ctx);
  const out = new Map<string, LadderState>();
  const lines = content.split("\n");
  // Track the most recent ticker mentioned in a ladder section so a
  // following `take-profit-50: fired ...` line can be attributed to it.
  let activeSymbol: string | null = null;
  for (const raw of lines) {
    const line = raw.trim();
    // Section reset on any new H3 (a Take-profit ladder section may be
    // multi-symbol but each symbol gets its own bullet immediately
    // before its take-profit-50 line).
    if (/^###\s+/.test(line)) {
      activeSymbol = null;
      continue;
    }
    const sym = line.match(/^-\s+([A-Z]{1,5}):\s*rung-1 fired @([+-]?\d+(?:\.\d+)?)/);
    if (sym) {
      activeSymbol = sym[1];
      // Eagerly seed the map with the bullet's pct in case the
      // explicit take-profit-50 line appears below or is missing.
      out.set(activeSymbol, {
        symbol: activeSymbol,
        rungFiredAt: "",
        firedAtPct: Number(sym[2]),
      });
      continue;
    }
    const tp = line.match(
      /take-profit-50:\s+fired\s+(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2})\s+at\s+([+-]?\d+(?:\.\d+)?)/i
    );
    if (tp && activeSymbol) {
      out.set(activeSymbol, {
        symbol: activeSymbol,
        rungFiredAt: tp[1],
        firedAtPct: Number(tp[2]),
      });
    }
  }
  return out;
}
