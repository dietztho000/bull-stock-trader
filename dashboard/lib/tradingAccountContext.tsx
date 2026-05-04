"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useTransition,
  type ReactNode,
} from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { AlpacaMode } from "@/lib/alpacaMode";
import type { Bot, RedactedAccount } from "@/lib/settings";
import { useSettingsOptional } from "@/components/providers/SettingsProvider";

const LS_KEY = "bullStockTrader.account";
const SESSION_LIVE_CONFIRMED = "bullStockTrader.liveConfirmed";
/** Cookie name read by the server-side TopToolbar so the freshness badge
 *  can scope to the user's actually-active bot, not the legacy BOT_MODE
 *  fallback (follow-up #4). Mirror of `LS_KEY` — written every time the
 *  active bot is committed. */
const ACTIVE_BOT_COOKIE = "bst-active-bot";
const COOKIE_MAX_AGE_S = 60 * 60 * 24 * 365; // 1 year — matches localStorage durability

function writeActiveBotCookie(botId: string) {
  if (typeof document === "undefined") return;
  try {
    document.cookie = `${ACTIVE_BOT_COOKIE}=${encodeURIComponent(
      botId
    )}; path=/; max-age=${COOKIE_MAX_AGE_S}; samesite=lax`;
  } catch {
    // ignore — server render will fall through to BOT_MODE
  }
}

/** True when the user has acknowledged the live-confirm modal in this
 *  session. Used by the Settings → Display revoke button to surface a
 *  signal that's otherwise invisible to the user. */
export function hasSessionLiveConfirmation(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.sessionStorage.getItem(SESSION_LIVE_CONFIRMED) === "1";
  } catch {
    return false;
  }
}

/** Drops the per-session live-confirm acknowledgement so the next switch
 *  to a live bot re-prompts the confirm dialog. */
export function revokeSessionLiveConfirmation(): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(SESSION_LIVE_CONFIRMED);
  } catch {
    // ignore
  }
}

type RequestResult = { requiresConfirm: boolean; commit: () => void };

/** Public ctx — `account` is preserved as the bot's underlying Alpaca mode
 *  (live|paper) so all existing consumers (ModeBadge, live-confirm gate,
 *  alpaca query strings) keep working unchanged. `botId` is the new
 *  registry-driven identity; `accountId` is the bot's bound credential
 *  set. Both default to the migrated "live"/"paper" bots when the
 *  registry is empty or still loading. */
type Ctx = {
  /** Bot id slug (e.g. "live", "paper", "momentum-10k"). Mirrored in URL
   *  `?account=` (legacy param name preserved for bookmark back-compat). */
  botId: string;
  /** Underlying Alpaca account id, or null if the bot or registry can't
   *  be resolved yet (loading state). */
  accountId: string | null;
  /** The bot's Alpaca mode — used by ModeBadge tinting, live-confirm gate,
   *  and legacy `?mode=` API queries. Falls back to "paper" while
   *  resolving. */
  account: AlpacaMode;
  /** Snapshot of the bot record. Null while loading or when the URL bot
   *  id isn't in the registry (e.g. just-deleted bot). */
  bot: Bot | null;
  /** Snapshot of the bot's bound account (redacted). */
  accountRecord: RedactedAccount | null;
  isPending: boolean;
  setAccount: (next: string) => void;
  requestSetAccount: (next: string) => RequestResult;
};

const TradingAccountContext = createContext<Ctx | null>(null);

const SLUG_RE = /^[a-z0-9][a-z0-9-]*$/;
const isSlug = (v: unknown): v is string => typeof v === "string" && SLUG_RE.test(v);

export function TradingAccountProvider({
  initialAccount,
  children,
}: {
  initialAccount: AlpacaMode;
  children: ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  // Bot + account registries are sourced from SettingsProvider's existing
  // /api/settings response — no second round-trip per layout mount (audit P5).
  // Falls back to empty arrays during SSR / before SettingsProvider hydrates.
  const settingsCtx = useSettingsOptional();
  const bots: Bot[] = settingsCtx?.bots ?? [];
  const accounts: RedactedAccount[] = settingsCtx?.accounts ?? [];

  // Accept both `?bot=` (current) and `?account=` (legacy bookmarks — A4 in
  // audit). Old bookmarks keep working until a future release drops the shim.
  const urlBotId = searchParams.get("bot") ?? searchParams.get("account");
  const botId: string = isSlug(urlBotId) ? urlBotId : initialAccount;
  const bot = bots.find((b) => b.id === botId) ?? null;
  const accountRecord = bot ? accounts.find((a) => a.id === bot.accountId) ?? null : null;
  const account: AlpacaMode = accountRecord?.mode ?? initialAccount;
  const accountId = bot?.accountId ?? null;

  const hydratedRef = useRef(false);
  useEffect(() => {
    if (hydratedRef.current) return;
    hydratedRef.current = true;
    if (urlBotId != null) {
      try {
        window.localStorage.setItem(LS_KEY, botId);
      } catch {
        // ignore quota / private mode failures
      }
      writeActiveBotCookie(botId);
      return;
    }
    let stored: string | null = null;
    try {
      stored = window.localStorage.getItem(LS_KEY);
    } catch {
      stored = null;
    }
    if (isSlug(stored) && stored !== initialAccount) {
      const params = new URLSearchParams(searchParams.toString());
      params.set("bot", stored);
      params.delete("account");
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    }
  }, [botId, initialAccount, pathname, router, searchParams, urlBotId]);

  const commit = useCallback(
    (next: string) => {
      try {
        window.localStorage.setItem(LS_KEY, next);
      } catch {
        // ignore
      }
      writeActiveBotCookie(next);
      const params = new URLSearchParams(searchParams.toString());
      params.set("bot", next);
      // Drop the legacy `account` key whenever we re-write the URL so a
      // shim-bookmarked tab progresses to the modern param after the first
      // dropdown change.
      params.delete("account");
      const qs = params.toString();
      startTransition(() => {
        router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
      });
    },
    [pathname, router, searchParams]
  );

  const requestSetAccount = useCallback(
    (next: string): RequestResult => {
      // Compute the destination bot's underlying mode from the registry —
      // can't trust the bot id alone since "live" the bot id is conventional
      // but new live bots could use other ids.
      const nextBot = bots.find((b) => b.id === next);
      const nextAccount = nextBot
        ? accounts.find((a) => a.id === nextBot.accountId)
        : null;
      // Audit A9 — when the registry hasn't loaded yet (or the bot is
      // somehow unbound), DEFAULT TO LIVE so the confirm dialog still
      // fires. Defaulting to "paper" here was a footgun: a click on a
      // live bot during the loading window would skip confirmation.
      const nextMode = nextAccount?.mode ?? "live";
      const needsConfirm =
        nextMode === "live" &&
        account === "paper" &&
        (() => {
          try {
            return window.sessionStorage.getItem(SESSION_LIVE_CONFIRMED) !== "1";
          } catch {
            return true;
          }
        })();
      return {
        requiresConfirm: needsConfirm,
        commit: () => {
          if (nextMode === "live") {
            try {
              window.sessionStorage.setItem(SESSION_LIVE_CONFIRMED, "1");
            } catch {
              // ignore
            }
          }
          commit(next);
        },
      };
    },
    [accounts, account, bots, commit]
  );

  const setAccount = useCallback(
    (next: string) => {
      const { requiresConfirm, commit: doCommit } = requestSetAccount(next);
      if (!requiresConfirm) doCommit();
    },
    [requestSetAccount]
  );

  const value = useMemo<Ctx>(
    () => ({
      botId,
      accountId,
      account,
      bot,
      accountRecord,
      isPending,
      setAccount,
      requestSetAccount,
    }),
    [botId, accountId, account, bot, accountRecord, isPending, setAccount, requestSetAccount]
  );

  return (
    <TradingAccountContext.Provider value={value}>
      {children}
    </TradingAccountContext.Provider>
  );
}

export function useTradingAccount(): Ctx {
  const ctx = useContext(TradingAccountContext);
  if (!ctx) {
    throw new Error(
      "useTradingAccount must be used inside <TradingAccountProvider>"
    );
  }
  return ctx;
}

export function useTradingAccountOptional(): Ctx | null {
  return useContext(TradingAccountContext);
}
