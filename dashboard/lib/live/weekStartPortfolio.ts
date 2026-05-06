import { runAlpaca, type RunAlpacaOpts } from "@/lib/alpaca";
import type { AlpacaMode } from "@/lib/alpacaMode";
import { currentWeekMondayCT } from "@/lib/time";

type PortfolioHistory = {
  timestamp?: number[];
  equity?: number[];
};

const TTL_MS = 60_000;
const cache = new Map<string, { value: number | null; expires: number }>();

export async function liveWeekStartPortfolio(
  mode: AlpacaMode = "live",
  accountId?: string | null
): Promise<number | null> {
  const monday = currentWeekMondayCT();
  const key = `${accountId ?? mode}:${monday}`;
  const hit = cache.get(key);
  if (hit && hit.expires > Date.now()) return hit.value;

  const value = await fetchWeekStart(mode, monday, accountId).catch(() => null);
  cache.set(key, { value, expires: Date.now() + TTL_MS });
  return value;
}

async function fetchWeekStart(
  mode: AlpacaMode,
  mondayISO: string,
  accountId?: string | null
): Promise<number | null> {
  const opts: RunAlpacaOpts = accountId ? { accountId } : { mode };
  const resp = (await runAlpaca(
    "portfolio-history",
    ["1W", "1D"],
    opts
  )) as PortfolioHistory;
  const ts = resp.timestamp ?? [];
  const eq = resp.equity ?? [];
  if (ts.length === 0 || ts.length !== eq.length) return null;
  const mondayMs = Date.parse(`${mondayISO}T00:00:00Z`);
  for (let i = 0; i < ts.length; i++) {
    const dayMs = ts[i] * 1000;
    if (dayMs >= mondayMs) {
      const v = eq[i];
      return Number.isFinite(v) && v > 0 ? v : null;
    }
  }
  return null;
}
