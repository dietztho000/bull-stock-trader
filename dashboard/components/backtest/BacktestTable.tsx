import clsx from "clsx";
import { Badge } from "@/components/ui/Card";
import { fmtMoney, fmtSignedMoney } from "@/lib/format";
import type { BacktestResult, Trade } from "@/lib/backtest/types";
import { compareToActual } from "@/lib/backtest/compare";

type Row = {
  result: BacktestResult;
  trade: Trade;
};

export function BacktestTable({ rows }: { rows: Row[] }) {
  if (rows.length === 0) {
    return (
      <div className="text-sm text-[var(--color-muted)] py-3">
        No closed trades to compare yet.
      </div>
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm tabular">
        <thead>
          <tr className="text-left text-[11px] uppercase tracking-wider text-[var(--color-muted)] border-b border-[var(--color-border)]">
            <th className="py-2 pr-3">Symbol</th>
            <th className="py-2 pr-3">Entry</th>
            <th className="py-2 pr-3">Actual exit</th>
            <th className="py-2 pr-3">Sim exit</th>
            <th className="py-2 pr-3">Sim reason</th>
            <th className="py-2 pr-3">Actual P&L</th>
            <th className="py-2 pr-3">Sim P&L</th>
            <th className="py-2 pr-3">Delta</th>
            <th className="py-2 pr-3">Ladder</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const cmp = compareToActual(r.result, r.trade);
            const deltaCls = clsx(
              "py-1.5 pr-3",
              cmp.pnlDelta != null && cmp.pnlDelta > 0 && "text-[var(--color-up)]",
              cmp.pnlDelta != null && cmp.pnlDelta < 0 && "text-[var(--color-down)]"
            );
            return (
              <tr key={i} className="border-b border-[var(--color-border)]/40 align-top">
                <td className="py-1.5 pr-3 font-semibold">
                  <div>{r.result.symbol}</div>
                  <div className="text-[10px] text-[var(--color-muted)]">
                    {r.trade.sector}
                  </div>
                </td>
                <td className="py-1.5 pr-3">
                  <div>{fmtMoney(r.result.entryPrice)}</div>
                  <div className="text-[10px] text-[var(--color-muted)]">
                    {r.result.entryDate} · {r.result.shares} sh
                  </div>
                </td>
                <td className="py-1.5 pr-3">
                  <div>{fmtMoney(r.trade.actualExitPrice)}</div>
                  <div className="text-[10px] text-[var(--color-muted)]">
                    {r.trade.actualExitDate}
                  </div>
                </td>
                <td className="py-1.5 pr-3">
                  {r.result.simExitPrice != null ? (
                    <>
                      <div>{fmtMoney(r.result.simExitPrice)}</div>
                      <div className="text-[10px] text-[var(--color-muted)]">
                        {r.result.simExitDate}
                      </div>
                    </>
                  ) : (
                    <span className="text-[var(--color-muted)]">—</span>
                  )}
                </td>
                <td className="py-1.5 pr-3">
                  <Badge tone="neutral">
                    <span className="font-mono">{r.result.simExitReason}</span>
                  </Badge>
                </td>
                <td className="py-1.5 pr-3">
                  {fmtSignedMoney(r.trade.actualPnl)}
                </td>
                <td className="py-1.5 pr-3">
                  {r.result.simPnl != null ? fmtSignedMoney(r.result.simPnl) : "—"}
                </td>
                <td className={deltaCls}>
                  {cmp.pnlDelta != null ? fmtSignedMoney(cmp.pnlDelta) : "—"}
                </td>
                <td className="py-1.5 pr-3">
                  {r.result.ladderFired ? (
                    <Badge tone="up">
                      ↓50% @ {fmtMoney(r.result.ladderFirePrice ?? 0)}
                    </Badge>
                  ) : (
                    <span className="text-[var(--color-muted)]">—</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
