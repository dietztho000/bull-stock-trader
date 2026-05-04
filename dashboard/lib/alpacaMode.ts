/** The Alpaca-API concept of an account *type*. Each `Account` record in
 *  settings has one of these values; it determines which Alpaca endpoint
 *  we hit and which color the mode badge shows. NOT a bot identity. */
export type AlpacaMode = "paper" | "live";

/** Stable slug used to identify a bot across UI, URL params, memory paths
 *  (`memory/<bot>/<strategy>/`), and `client_order_id` prefixes. Validated
 *  via `slugSchema` in settings.schema.ts. */
export type BotId = string;

/** Builds the URL for an `/api/alpaca/<cmd>` query, scoped to either a
 *  specific accountId (preferred) or a legacy `mode` (`live`|`paper`).
 *
 *  Returns `null` when neither is set — callers should pass the result
 *  straight to SWR's first arg, which treats `null` as "skip this fetch."
 *  This prevents the silent fallback to the host's `BOT_MODE` env, which
 *  used to make a paper bot's tile briefly query the live account during
 *  hydration. */
export function alpacaApiUrl(cmd: string, mode: AlpacaMode): string;
export function alpacaApiUrl(
  cmd: string,
  arg: { accountId: string } | { accountId: string; mode?: AlpacaMode }
): string;
export function alpacaApiUrl(
  cmd: string,
  arg: AlpacaMode | undefined | { mode?: AlpacaMode; accountId?: string }
): string | null;
export function alpacaApiUrl(
  cmd: string,
  arg?: AlpacaMode | { mode?: AlpacaMode; accountId?: string }
): string | null {
  const opts =
    typeof arg === "string" || arg === undefined
      ? { mode: arg as AlpacaMode | undefined }
      : arg;
  const params = new URLSearchParams();
  if (opts.accountId) params.set("accountId", opts.accountId);
  else if (opts.mode) params.set("mode", opts.mode);
  else return null;
  return `/api/alpaca/${cmd}?${params.toString()}`;
}
