import { runAlpaca, type AlpacaMode, type RunAlpacaOpts } from "@/lib/alpaca";

// Computes overnight gap = (today_open - yesterday_close) / yesterday_close
// for each symbol. Server-side only. Returns Map<symbol, gapPctOrNull>.
//
// Bars endpoint returns up to `limit` bars in chronological order. With
// limit=2 we expect [yesterday, today] when the market has opened, or
// just [yesterday] before today's bar exists.
type BarsResp = {
  bars?: Array<{ t: string; o: number; h: number; l: number; c: number }>;
};

export async function loadOvernightGaps(
  symbols: string[],
  mode: AlpacaMode,
  accountId?: string | null
): Promise<Map<string, number | null>> {
  const out = new Map<string, number | null>();
  const opts: RunAlpacaOpts = accountId ? { accountId } : { mode };
  // Run bars fetches in parallel; failures are non-fatal (gap badge just
  // shows nothing for that symbol).
  await Promise.all(
    symbols.map(async (sym) => {
      try {
        const resp = (await runAlpaca(
          "bars",
          [sym, "1Day", "", "", "2"],
          opts
        )) as BarsResp;
        const bars = resp.bars ?? [];
        if (bars.length < 2) {
          out.set(sym, null);
          return;
        }
        const [yesterday, today] = bars.slice(-2);
        const gap = (today.o - yesterday.c) / yesterday.c;
        out.set(sym, Number.isFinite(gap) ? gap : null);
      } catch {
        out.set(sym, null);
      }
    })
  );
  return out;
}
