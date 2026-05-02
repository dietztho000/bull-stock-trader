import { runAlpaca } from "@/lib/alpaca";

type Bar = { t: string; o: number; c: number };
type BarsResp = { bars?: Bar[] };

const TTL_MS = 60_000;
const cache = new Map<string, { value: number | null; expires: number }>();

export async function liveSpyPhasePct(phaseStart: string | null): Promise<number | null> {
  if (!phaseStart) return null;
  const key = phaseStart;
  const hit = cache.get(key);
  if (hit && hit.expires > Date.now()) return hit.value;

  const value = await fetchSpyPhasePct(phaseStart).catch(() => null);
  cache.set(key, { value, expires: Date.now() + TTL_MS });
  return value;
}

async function fetchSpyPhasePct(phaseStart: string): Promise<number | null> {
  const start = `${phaseStart}T00:00:00Z`;
  const resp = (await runAlpaca("bars", ["SPY", "1Day", start])) as BarsResp;
  const bars = resp?.bars ?? [];
  if (bars.length < 1) return null;
  const first = bars[0];
  const last = bars[bars.length - 1];
  if (!first?.o || !last?.c || first.o <= 0) return null;
  return (last.c / first.o - 1) * 100;
}
