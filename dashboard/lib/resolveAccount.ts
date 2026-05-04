import { activeTab } from "./activeTab";
import { readBotMode } from "./mode";
import { listAccounts, listBots } from "./settings";
import type { AlpacaMode, BotId } from "./alpacaMode";

/** Built-in bot ids that exist after the env-seed migration runs. The
 *  generic `BotId` is any registered slug; this tuple is just the legacy
 *  pair retained for type-narrowing in places that still need a literal
 *  `AlpacaMode`. */
export const ACCOUNT_TABS = ["live", "paper"] as const;

type SearchParamMap = { [key: string]: string | string[] | undefined } | undefined;

/** Legacy resolver: returns "live" | "paper" for code paths that haven't
 *  migrated to bot ids yet. Prefer `resolveBotId` for new code. */
export async function resolveAccount(searchParams: SearchParamMap): Promise<AlpacaMode> {
  const fallback = await readBotMode();
  return activeTab<AlpacaMode>(searchParams, "account", ACCOUNT_TABS, fallback);
}

/** Multi-bot resolver: looks at the URL `?bot=<bot-id>` (with `?account=`
 *  accepted as a one-release back-compat shim for old bookmarks — A4 in
 *  audit), validates against the registry, falls back to the first enabled
 *  bot or `BOT_MODE`.
 *
 *  Audit A1: a URL pointing at `?bot=live` (or `?account=live`) on an
 *  install that has migrated to the `legacy-live` bot id transparently
 *  resolves to `legacy-live`. Same for `paper` → `legacy-paper`. Old
 *  bookmarks keep working without redirect noise. */
export async function resolveBotId(searchParams: SearchParamMap): Promise<BotId> {
  const raw = searchParams?.["bot"] ?? searchParams?.["account"];
  const candidate = Array.isArray(raw) ? raw[0] : raw;
  const bots = await listBots();
  const enabledIds = bots.filter((b) => b.enabled).map((b) => b.id);
  if (candidate && enabledIds.includes(candidate)) return candidate;
  // URL shim: `?bot=live` → `legacy-live` if the user is on a post-migration
  // install. The reverse (legacy → live) doesn't apply because the audit's
  // direction is one-way.
  if (candidate === "live" && enabledIds.includes("legacy-live")) return "legacy-live";
  if (candidate === "paper" && enabledIds.includes("legacy-paper")) return "legacy-paper";
  if (enabledIds.length > 0) {
    // Prefer a bot whose id matches the legacy BOT_MODE if one exists.
    const legacy = await readBotMode();
    if (enabledIds.includes(legacy)) return legacy;
    if (legacy === "live" && enabledIds.includes("legacy-live")) return "legacy-live";
    if (legacy === "paper" && enabledIds.includes("legacy-paper")) return "legacy-paper";
    return enabledIds[0];
  }
  return await readBotMode();
}

/** Read the bot id from a `URLSearchParams`-like, accepting both the
 *  current `?bot=` and the legacy `?account=`. Returns null if neither
 *  is set. Used by API routes that don't have a full `SearchParamMap`. */
export function readBotParam(
  search: URLSearchParams | { get(name: string): string | null }
): string | null {
  return search.get("bot") ?? search.get("account");
}

/** Resolves the full per-page bot context: id, strategy slug (for memory
 *  paths), and bound account id (for Alpaca calls). Use this in any
 *  server-rendered page that needs to load a bot's memory and Alpaca data. */
export async function resolveBotCtx(searchParams: SearchParamMap): Promise<{
  botId: BotId;
  /** Memory directory name under `memory/<dir>/<strategy>/`. Equals
   *  `bot.memoryAlias` when set (audit A1) so a renamed seed bot like
   *  `legacy-live` still reads from the original `memory/live/` tree.
   *  Falls back to `botId` for bots without an alias. */
  memoryDir: BotId;
  strategy: string;
  accountId: string | null;
  /** The bot's underlying Alpaca mode, derived from its bound account.
   *  Falls back to the legacy BOT_MODE when the registry doesn't know the
   *  bot (e.g. fresh install before migration). */
  mode: AlpacaMode;
}> {
  const botId = await resolveBotId(searchParams);
  const bots = await listBots();
  const bot = bots.find((b) => b.id === botId);
  const strategy = bot?.strategySlug ?? "default";
  const accountId = bot?.accountId ?? null;
  const memoryDir = bot?.memoryAlias ?? botId;
  let mode: AlpacaMode;
  if (accountId) {
    const accounts = await listAccounts();
    const acct = accounts.find((a) => a.id === accountId);
    mode = acct?.mode ?? (await readBotMode());
  } else {
    mode = await readBotMode();
  }
  return { botId, memoryDir, strategy, accountId, mode };
}

// ─── Order-write identity resolver (shared by /api/alpaca/order +
// /api/alpaca/close — A5 in audit). Both routes used to reimplement this
// with subtle differences (close uses `account` not `accounts`, has its own
// FK check). Centralizing here guarantees they stay in lockstep when
// e.g. `--via-bot-routine=true` lands. ────────────────────────────────

import type { RunAlpacaOpts } from "./alpaca";

export type OrderIdentityInput = {
  accountId?: string;
  botId?: string;
  mode?: AlpacaMode;
};

export type ResolvedOrderIdentity = {
  /** What we pass to runAlpacaWrite. Exactly one of mode/accountId is set,
   *  with accountId taking priority when both are. */
  opts: RunAlpacaOpts;
  /** For audit-log + live-confirmation. Always populated. */
  effectiveMode: AlpacaMode;
  accountId: string | null;
  botId: string | null;
  /** For rate-limiter bucket key. Caller prefixes with the verb (`order:`, `close:`). */
  bucket: string;
};

export type OrderIdentityError = { error: string; status: number };

export async function resolveOrderIdentity(
  body: OrderIdentityInput
): Promise<ResolvedOrderIdentity | OrderIdentityError> {
  if (body.accountId) {
    const accounts = await listAccounts();
    const account = accounts.find((a) => a.id === body.accountId);
    if (!account) {
      return { error: `accountId "${body.accountId}" not found`, status: 404 };
    }
    if (body.botId) {
      const bots = await listBots();
      const bot = bots.find((b) => b.id === body.botId);
      if (!bot) {
        return { error: `botId "${body.botId}" not found`, status: 404 };
      }
      if (bot.accountId !== account.id) {
        return {
          error: `bot "${body.botId}" is bound to account "${bot.accountId}", not "${account.id}"`,
          status: 400,
        };
      }
    }
    return {
      opts: { accountId: account.id, botId: body.botId },
      effectiveMode: account.mode,
      accountId: account.id,
      botId: body.botId ?? null,
      bucket: account.id,
    };
  }
  if (!body.mode) {
    return { error: "must include accountId or mode", status: 400 };
  }
  return {
    opts: { mode: body.mode },
    effectiveMode: body.mode,
    accountId: null,
    botId: null,
    bucket: body.mode,
  };
}
