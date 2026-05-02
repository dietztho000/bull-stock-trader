"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { AlpacaMode } from "@/lib/alpacaMode";

const LS_KEY = "bullStockTrader.account";
const SESSION_LIVE_CONFIRMED = "bullStockTrader.liveConfirmed";

type RequestResult = { requiresConfirm: boolean; commit: () => void };

type Ctx = {
  account: AlpacaMode;
  isPending: boolean;
  setAccount: (next: AlpacaMode) => void;
  requestSetAccount: (next: AlpacaMode) => RequestResult;
};

const TradingAccountContext = createContext<Ctx | null>(null);

function isAlpacaMode(value: unknown): value is AlpacaMode {
  return value === "live" || value === "paper";
}

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

  const urlMode = searchParams.get("account");
  const account: AlpacaMode = isAlpacaMode(urlMode) ? urlMode : initialAccount;

  const hydratedRef = useRef(false);
  useEffect(() => {
    if (hydratedRef.current) return;
    hydratedRef.current = true;
    if (urlMode != null) {
      try {
        window.localStorage.setItem(LS_KEY, account);
      } catch {
        // ignore quota / private mode failures
      }
      return;
    }
    let stored: string | null = null;
    try {
      stored = window.localStorage.getItem(LS_KEY);
    } catch {
      stored = null;
    }
    if (isAlpacaMode(stored) && stored !== initialAccount) {
      const params = new URLSearchParams(searchParams.toString());
      params.set("account", stored);
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    }
  }, [account, initialAccount, pathname, router, searchParams, urlMode]);

  const commit = useCallback(
    (next: AlpacaMode) => {
      try {
        window.localStorage.setItem(LS_KEY, next);
      } catch {
        // ignore
      }
      const params = new URLSearchParams(searchParams.toString());
      params.set("account", next);
      const qs = params.toString();
      startTransition(() => {
        router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
      });
    },
    [pathname, router, searchParams]
  );

  const requestSetAccount = useCallback(
    (next: AlpacaMode): RequestResult => {
      const needsConfirm =
        next === "live" &&
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
          if (next === "live") {
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
    [account, commit]
  );

  const setAccount = useCallback(
    (next: AlpacaMode) => {
      const { requiresConfirm, commit: doCommit } = requestSetAccount(next);
      if (!requiresConfirm) doCommit();
    },
    [requestSetAccount]
  );

  const value = useMemo<Ctx>(
    () => ({ account, isPending, setAccount, requestSetAccount }),
    [account, isPending, setAccount, requestSetAccount]
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
