"use client";

import useSWR from "swr";
import clsx from "clsx";
import { motion } from "framer-motion";
import { fmtMoney, fmtPct, fmtSignedMoney, colorOf } from "@/lib/format";
import { alpacaApiUrl, type AlpacaMode } from "@/lib/alpacaMode";
import { BreakerPills } from "./BreakerPills";

const fetcher = (u: string) => fetch(u).then((r) => r.json());

type Account = {
  equity: string;
  last_equity: string;
  cash: string;
  portfolio_value: string;
};

type Position = { symbol: string };

export function PnlHero({
  mode = "live",
  startingEquity,
  phaseStart,
  yesterdayPortfolio,
  weekStartPortfolio,
  spyPhasePct,
}: {
  mode?: AlpacaMode;
  startingEquity: number | null;
  phaseStart: string | null;
  yesterdayPortfolio: number | null;
  weekStartPortfolio: number | null;
  spyPhasePct: number | null;
}) {
  const { data: account } = useSWR<Account | { error: string }>(
    alpacaApiUrl("account", mode),
    fetcher,
    { refreshInterval: 5000 }
  );
  const { data: positions } = useSWR<Position[] | { error: string }>(
    alpacaApiUrl("positions", mode),
    fetcher,
    { refreshInterval: 5000 }
  );

  const isError = !account || "error" in account;
  const equity = !isError ? Number((account as Account).equity) : null;

  const dayPnl =
    equity != null && yesterdayPortfolio != null ? equity - yesterdayPortfolio : null;
  const dayPct =
    equity != null && yesterdayPortfolio != null && yesterdayPortfolio > 0
      ? ((equity - yesterdayPortfolio) / yesterdayPortfolio) * 100
      : null;

  const phasePnl =
    equity != null && startingEquity != null ? equity - startingEquity : null;
  const phasePct =
    equity != null && startingEquity != null && startingEquity > 0
      ? ((equity - startingEquity) / startingEquity) * 100
      : null;
  const alphaVsSpy =
    phasePct != null && spyPhasePct != null ? phasePct - spyPhasePct : null;

  const weekPct =
    equity != null && weekStartPortfolio != null && weekStartPortfolio > 0
      ? ((equity - weekStartPortfolio) / weekStartPortfolio) * 100
      : null;

  const slotsUsed = Array.isArray(positions) ? positions.length : null;

  return (
    <section className="frost rounded-3xl p-6 sm:p-8 relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none opacity-50">
        <div
          className={clsx(
            "absolute -top-32 -right-32 w-96 h-96 rounded-full blur-3xl transition-colors duration-500",
            colorOf(dayPnl) === true && "bg-[var(--color-up)]/15",
            colorOf(dayPnl) === false && "bg-[var(--color-down)]/15",
            colorOf(dayPnl) === null && "bg-[var(--color-accent)]/10"
          )}
        />
      </div>

      <div className="relative grid gap-6 sm:grid-cols-2 sm:items-end">
        <div>
          <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--color-muted)] font-semibold mb-2">
            Today
          </div>
          <motion.div
            key={dayPnl ?? 0}
            initial={{ opacity: 0.6 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
            className={clsx(
              "text-5xl sm:text-6xl font-semibold tabular tracking-tight leading-none",
              colorOf(dayPnl) === true && "text-[var(--color-up)]",
              colorOf(dayPnl) === false && "text-[var(--color-down)]",
              colorOf(dayPnl) === null && "text-[var(--color-text)]"
            )}
          >
            {dayPnl != null ? fmtSignedMoney(dayPnl) : "—"}
          </motion.div>
          <div className="mt-2 text-base tabular text-[var(--color-muted)]">
            {dayPct != null ? fmtPct(dayPct) : "—"}{" "}
            <span className="text-xs">vs prior close</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:gap-4">
          <Stat
            label="Phase P&L"
            value={phasePnl != null ? fmtSignedMoney(phasePnl) : "—"}
            delta={phasePct != null ? fmtPct(phasePct) : null}
            tone={colorOf(phasePnl)}
            hint={phaseStart ? `since ${phaseStart}` : undefined}
          />
          <Stat
            label="Alpha vs SPY"
            value={alphaVsSpy != null ? fmtPct(alphaVsSpy) : "—"}
            tone={colorOf(alphaVsSpy)}
            hint={spyPhasePct != null ? `SPY ${fmtPct(spyPhasePct)}` : undefined}
          />
          <Stat
            label="Equity"
            value={equity != null ? fmtMoney(equity) : "—"}
            tone={null}
            hint={startingEquity != null ? `start ${fmtMoney(startingEquity)}` : undefined}
          />
          <Stat
            label="Cash"
            value={!isError ? fmtMoney(Number((account as Account).cash)) : "—"}
            tone={null}
            hint={
              !isError && equity != null && equity > 0
                ? `${(((equity - Number((account as Account).cash)) / equity) * 100).toFixed(0)}% deployed`
                : undefined
            }
          />
        </div>
      </div>

      <div className="relative mt-6 pt-5 border-t border-[rgba(255,255,255,0.05)]">
        <BreakerPills dayPct={dayPct} weekPct={weekPct} slotsUsed={slotsUsed} />
      </div>
    </section>
  );
}

function Stat({
  label,
  value,
  delta,
  tone,
  hint,
}: {
  label: string;
  value: string;
  delta?: string | null;
  tone: boolean | null;
  hint?: string;
}) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-[0.14em] text-[var(--color-muted)] font-medium">
        {label}
      </div>
      <div className="mt-1 text-xl font-semibold tabular">{value}</div>
      {(delta || hint) && (
        <div className="mt-0.5 text-[11px] flex items-center gap-1.5">
          {delta && (
            <span
              className={clsx(
                "tabular font-medium",
                tone === true && "text-[var(--color-up)]",
                tone === false && "text-[var(--color-down)]",
                tone == null && "text-[var(--color-muted)]"
              )}
            >
              {delta}
            </span>
          )}
          {hint && <span className="text-[var(--color-muted)]">{hint}</span>}
        </div>
      )}
    </div>
  );
}
