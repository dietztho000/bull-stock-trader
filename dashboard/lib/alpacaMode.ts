/** The Alpaca-API concept of an account *type*. Each `Account` record in
 *  settings has one of these values; it determines which Alpaca endpoint
 *  we hit and which color the mode badge shows. NOT a bot identity. */
export type AlpacaMode = "paper" | "live";

/** Stable slug used to identify a bot across UI, URL params, memory paths
 *  (`memory/<bot>/<strategy>/`), and `client_order_id` prefixes. Validated
 *  via `slugSchema` in settings.schema.ts. */
export type BotId = string;

/** Audit NA1 — discriminated union replacing the dual-prop `(mode, accountId)`
 *  pattern that proliferated across the dashboard. A scope identifies WHICH
 *  Alpaca account a render or fetch should hit; either by registry id (the
 *  multi-account path) or by legacy `paper`/`live` env-cred mode (pre-
 *  registry installs only). Components that previously took
 *  `{ mode, accountId }` should converge on `{ scope }` over time.
 *
 *  Construction is centralized via `accountScope(mode, accountId)` so a
 *  caller never has to spell out the union — pass whatever it has and the
 *  helper picks the right variant. */
export type AlpacaScope =
  | { kind: "account"; accountId: string }
  | { kind: "mode"; mode: AlpacaMode }
  | { kind: "none" };

/** Build an `AlpacaScope` from the loose `(mode?, accountId?)` shape that
 *  prevails throughout the React tree. Prefers `accountId` when both are
 *  present (matches `RunAlpacaOpts` precedence). Returns the `none` variant
 *  only when both are missing — the caller should generally treat this as
 *  "skip this fetch" (mirrors `alpacaApiUrl` returning `null`). */
export function accountScope(
  mode?: AlpacaMode,
  accountId?: string | null
): AlpacaScope {
  if (accountId) return { kind: "account", accountId };
  if (mode) return { kind: "mode", mode };
  return { kind: "none" };
}

/** Convenience extractor for sites that still need the legacy pair (e.g.
 *  passing into `RunAlpacaOpts` or `alpacaApiUrl`). Lets a migrated
 *  component drop the dual prop without forcing every downstream helper
 *  to migrate in lockstep. */
export function scopeToPair(scope: AlpacaScope | undefined): {
  mode?: AlpacaMode;
  accountId?: string;
} {
  if (!scope || scope.kind === "none") return {};
  if (scope.kind === "account") return { accountId: scope.accountId };
  return { mode: scope.mode };
}

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
