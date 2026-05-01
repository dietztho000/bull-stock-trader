export type AlpacaMode = "paper" | "live";

export function alpacaApiUrl(cmd: string, mode?: AlpacaMode): string {
  return mode ? `/api/alpaca/${cmd}?mode=${mode}` : `/api/alpaca/${cmd}`;
}
