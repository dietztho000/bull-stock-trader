import { Suspense } from "react";
import { Card, Kpi, Badge } from "@/components/ui/Card";
import { TradesTable, type ClosedTradeWithSizing } from "@/components/tables/TradesTable";
import { Histogram } from "@/components/charts/Histogram";
import { RScatter } from "@/components/charts/RScatter";
import { SectorBars } from "@/components/charts/SectorBars";
import { UrlTabs } from "@/components/ui/UrlTabs";
import { SkeletonBox } from "@/components/ui/Skeleton";
import { DashboardGrid } from "@/components/layout/DashboardGrid";
import { LayoutProvider } from "@/components/layout/LayoutEditContext";
import { EditLayoutToggle } from "@/components/layout/EditLayoutToggle";
import { TRADES_ALL_LAYOUT, TRADES_SECTORS_LAYOUT } from "@/components/layout/defaults";
import { activeTab } from "@/lib/activeTab";
import { loadSectorLedger } from "@/lib/parsers/sectorLedger";
import { loadSectorMap } from "@/lib/parsers/sectorMap";
import { loadResearchLog } from "@/lib/parsers/researchLog";
import { loadTradeLog } from "@/lib/parsers/tradeLog";
import { computeTradeStats, bySector } from "@/lib/stats/tradeStats";
import { rMultiples, avgR } from "@/lib/stats/rMultiple";
import { fmtMoney, fmtPct, fmtSignedMoney } from "@/lib/format";
import { targetPctForScore, actualPctOfEquity } from "@/lib/stats/sizing";
import { runAlpaca } from "@/lib/alpaca";
import { detectAccountInfo, readBotMode } from "@/lib/mode";
import type { AlpacaMode } from "@/lib/alpacaMode";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const SECTOR_CAP = 3;
const TABS = ["all", "sectors"] as const;
const ACCOUNT_TABS = ["live", "paper"] as const;
type Tab = (typeof TABS)[number];

const TAB_OPTIONS: { value: Tab; label: string }[] = [
  { value: "all", label: "All trades" },
  { value: "sectors", label: "By sector" },
];

type LivePositionLite = { symbol: string };

async function loadLiveConcentration(mode: AlpacaMode): Promise<{
  bySector: Map<string, string[]>;
  rawCount: number;
} | null> {
  try {
    const probe = await detectAccountInfo(mode);
    if (!probe.configured || probe.error) return null;
    const positions = (await runAlpaca("positions", [], { mode })) as
      | LivePositionLite[]
      | { error: string };
    if (!Array.isArray(positions)) return null;
    const sectorMap = await loadSectorMap();
    const out = new Map<string, string[]>();
    for (const p of positions) {
      const sector = sectorMap.get(p.symbol.toUpperCase()) ?? "Unknown";
      if (!out.has(sector)) out.set(sector, []);
      out.get(sector)!.push(p.symbol.toUpperCase());
    }
    return { bySector: out, rawCount: positions.length };
  } catch {
    return null;
  }
}

export default async function TradesPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const sp = await searchParams;
  const tab = activeTab<Tab>(sp, "tab", TABS, "all");
  const defaultMode = await readBotMode();
  const accountMode = activeTab<AlpacaMode>(sp, "account", ACCOUNT_TABS, defaultMode);

  const [ledger, tradeLog] = await Promise.all([
    loadSectorLedger(),
    loadTradeLog(),
  ]);
  const stats = computeTradeStats(ledger.closed);
  const rs = rMultiples(ledger.closed, tradeLog.entries);
  const avg = avgR(rs);

  const kpiTiles: Record<string, React.ReactNode> = {
    "kpi-closed": (
      <Kpi
        label="Closed trades"
        value={String(stats.total)}
        hint={`${stats.wins}W / ${stats.losses}L / ${stats.breakeven}B`}
      />
    ),
    "kpi-winrate": (
      <Kpi label="Win rate" value={`${(stats.winRate * 100).toFixed(1)}%`} />
    ),
    "kpi-pnl": (
      <Kpi label="Realized P&L" value={fmtSignedMoney(stats.totalPnl)} />
    ),
    "kpi-avg-r": (
      <Kpi label="Avg R" value={avg != null ? avg.toFixed(2) : "—"} />
    ),
    "kpi-profit-factor": (
      <Kpi
        label="Profit factor"
        value={
          stats.profitFactor != null && Number.isFinite(stats.profitFactor)
            ? stats.profitFactor.toFixed(2)
            : "—"
        }
      />
    ),
  };

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Trades</h1>
          <p className="text-xs text-[var(--color-muted)] mt-0.5">
            All closed trades and per-sector concentration vs caps.
          </p>
        </div>
        <UrlTabs<Tab> layoutId="trades-tabs" options={TAB_OPTIONS} fallback="all" />
      </header>

      {tab === "all" && (
        <AllTradesTab
          ledger={ledger}
          tradeLog={tradeLog}
          stats={stats}
          rs={rs}
          kpiTiles={kpiTiles}
        />
      )}
      {tab === "sectors" && (
        <SectorsTab ledger={ledger} kpiTiles={kpiTiles} mode={accountMode} />
      )}
    </div>
  );
}

function AllTradesTab({
  ledger,
  tradeLog,
  stats,
  rs,
  kpiTiles,
}: {
  ledger: Awaited<ReturnType<typeof loadSectorLedger>>;
  tradeLog: Awaited<ReturnType<typeof loadTradeLog>>;
  stats: ReturnType<typeof computeTradeStats>;
  rs: ReturnType<typeof rMultiples>;
  kpiTiles: Record<string, React.ReactNode>;
}) {
  const sortedSnapshots = [...tradeLog.snapshots]
    .filter((s) => s.date && s.portfolio != null)
    .sort((a, b) => (a.date! > b.date! ? 1 : -1));
  function equityBefore(date: string): number | null {
    let last: number | null = null;
    for (const s of sortedSnapshots) {
      if (s.date! < date) last = s.portfolio;
      else break;
    }
    return last;
  }
  const enrichedTrades: ClosedTradeWithSizing[] = ledger.closed.map((t) => {
    const entry = tradeLog.entries.find(
      (e) => e.ticker.toUpperCase() === t.symbol.toUpperCase() && e.date === t.date
    );
    const score = entry?.scorer?.total ?? null;
    const targetPct = targetPctForScore(score);
    const equityAtEntry = t.date ? equityBefore(t.date) : null;
    const actualPct = actualPctOfEquity(
      entry?.shares ?? null,
      entry?.entry ?? null,
      equityAtEntry
    );
    return { ...t, score, targetPct, actualPct };
  });

  const scorerScatter = ledger.closed
    .map((t) => {
      const entry = tradeLog.entries.find(
        (e) => e.ticker === t.symbol && e.scorer?.total != null
      );
      if (!entry?.scorer?.total || t.pnlPct == null) return null;
      return { x: entry.scorer.total, y: t.pnlPct, symbol: t.symbol, date: t.date };
    })
    .filter(Boolean) as { x: number; y: number; symbol: string; date: string }[];

  const tiles: Record<string, React.ReactNode> = {
    ...kpiTiles,
    table: (
      <Card title="All closed trades">
        <TradesTable trades={enrichedTrades} />
      </Card>
    ),
    distributions: (
      <details className="frost rounded-2xl no-drag">
        <summary className="cursor-pointer select-none px-5 py-3 flex items-center justify-between text-sm">
          <span className="text-[11px] font-semibold tracking-[0.12em] uppercase text-[var(--color-muted)]">
            Distributions
          </span>
          <span className="text-[10px] text-[var(--color-muted)]">
            P&L %, R-multiples, scorer correlation
          </span>
        </summary>
        <div className="px-5 pb-5 space-y-5">
          <div className="grid lg:grid-cols-2 gap-5">
            <Card title="P&L % distribution" subtitle="Realized return per trade">
              <Histogram
                values={ledger.closed
                  .map((t) => t.pnlPct)
                  .filter((v): v is number => v != null)}
                format="pct"
              />
            </Card>
            <Card
              title="R-multiple distribution"
              subtitle="(exit − entry) / |entry − stop|"
            >
              <Histogram values={rs.map((r) => r.r)} format="number" />
            </Card>
          </div>

          <Card
            title="Entry scorer vs realized P&L %"
            subtitle="Did high-conviction entries pay off?"
          >
            <RScatter data={scorerScatter} />
          </Card>
        </div>
      </details>
    ),
    "best-worst": (
      <Card title="Best and worst">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <div className="text-[var(--color-muted)] text-[10px] uppercase tracking-[0.14em] mb-1">
              Best trade
            </div>
            {stats.best ? (
              <div>
                <span className="font-semibold">{stats.best.symbol}</span>{" "}
                <span className="text-[var(--color-up)] tabular">
                  {fmtSignedMoney(stats.best.pnl)}
                </span>{" "}
                <span className="text-[var(--color-muted)]">
                  {fmtPct(stats.best.pnlPct)} · {stats.best.date}
                </span>
              </div>
            ) : (
              "—"
            )}
          </div>
          <div>
            <div className="text-[var(--color-muted)] text-[10px] uppercase tracking-[0.14em] mb-1">
              Worst trade
            </div>
            {stats.worst ? (
              <div>
                <span className="font-semibold">{stats.worst.symbol}</span>{" "}
                <span className="text-[var(--color-down)] tabular">
                  {fmtSignedMoney(stats.worst.pnl)}
                </span>{" "}
                <span className="text-[var(--color-muted)]">
                  {fmtPct(stats.worst.pnlPct)} · {stats.worst.date}
                </span>
              </div>
            ) : (
              "—"
            )}
          </div>
        </div>
      </Card>
    ),
  };

  return (
    <LayoutProvider pageId="trades:all" spec={TRADES_ALL_LAYOUT}>
      <div className="flex justify-end -mt-2 mb-1">
        <EditLayoutToggle />
      </div>
      <DashboardGrid tiles={tiles} />
    </LayoutProvider>
  );
}

function SectorsTab({
  ledger,
  kpiTiles,
  mode,
}: {
  ledger: Awaited<ReturnType<typeof loadSectorLedger>>;
  kpiTiles: Record<string, React.ReactNode>;
  mode: AlpacaMode;
}) {
  const grouped = bySector(ledger.closed);
  const pnlBars = grouped.map((g) => ({
    sector: g.sector,
    value: g.stats.totalPnl,
  }));

  const tiles: Record<string, React.ReactNode> = {
    ...kpiTiles,
    "live-concentration": (
      <Suspense fallback={<SkeletonBox height={180} />}>
        <LiveConcentrationSection mode={mode} />
      </Suspense>
    ),
    "streak-status": (
      <Card
        title="Sector streak status"
        subtitle="Rule #10: 2 consecutive losses → sector blocked for 30 days"
      >
        {ledger.streaks.length === 0 ? (
          <div className="text-sm text-[var(--color-muted)]">
            No sector data yet — fills in once trades close.
          </div>
        ) : (
          <table className="w-full text-sm tabular">
            <thead>
              <tr className="text-left text-[10px] uppercase tracking-[0.14em] text-[var(--color-muted)] border-b border-[rgba(255,255,255,0.08)]">
                <th className="py-2 pr-3">Sector</th>
                <th className="py-2 pr-3">Last 2 outcomes</th>
                <th className="py-2 pr-3">30-day streak</th>
                <th className="py-2 pr-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {ledger.streaks.map((s) => (
                <tr key={s.sector} className="border-b border-[rgba(255,255,255,0.04)]">
                  <td className="py-1.5 pr-3 font-semibold">{s.sector}</td>
                  <td className="py-1.5 pr-3">{s.lastTwo}</td>
                  <td className="py-1.5 pr-3">{s.streak}</td>
                  <td className="py-1.5 pr-3">
                    {s.status === "BLOCKED" ? (
                      <Badge tone="down">BLOCKED</Badge>
                    ) : (
                      <Badge tone="up">{s.status || "OPEN"}</Badge>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    ),
    "pnl-by-sector": (
      <Card title="Realized P&L by sector">
        <SectorBars data={pnlBars} format="money" />
      </Card>
    ),
    "per-sector-stats": (
      <Card title="Per-sector stats">
        {grouped.length === 0 ? (
          <div className="text-sm text-[var(--color-muted)]">No closed trades yet.</div>
        ) : (
          <table className="w-full text-sm tabular">
            <thead>
              <tr className="text-left text-[10px] uppercase tracking-[0.14em] text-[var(--color-muted)] border-b border-[rgba(255,255,255,0.08)]">
                <th className="py-2 pr-3">Sector</th>
                <th className="py-2 pr-3">Trades</th>
                <th className="py-2 pr-3">Win rate</th>
                <th className="py-2 pr-3">P&L</th>
                <th className="py-2 pr-3">Avg win</th>
                <th className="py-2 pr-3">Avg loss</th>
                <th className="py-2 pr-3">Profit factor</th>
                <th className="py-2 pr-3">Expectancy</th>
              </tr>
            </thead>
            <tbody>
              {grouped.map((g) => (
                <tr key={g.sector} className="border-b border-[rgba(255,255,255,0.04)]">
                  <td className="py-1.5 pr-3 font-semibold">{g.sector}</td>
                  <td className="py-1.5 pr-3">{g.stats.total}</td>
                  <td className="py-1.5 pr-3">{(g.stats.winRate * 100).toFixed(0)}%</td>
                  <td className="py-1.5 pr-3">{fmtSignedMoney(g.stats.totalPnl)}</td>
                  <td className="py-1.5 pr-3">{fmtMoney(g.stats.avgWin)}</td>
                  <td className="py-1.5 pr-3">{fmtMoney(g.stats.avgLoss)}</td>
                  <td className="py-1.5 pr-3">
                    {g.stats.profitFactor != null && Number.isFinite(g.stats.profitFactor)
                      ? g.stats.profitFactor.toFixed(2)
                      : "—"}
                  </td>
                  <td className="py-1.5 pr-3">{fmtSignedMoney(g.stats.expectancy)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    ),
  };

  return (
    <LayoutProvider pageId="trades:sectors" spec={TRADES_SECTORS_LAYOUT}>
      <div className="flex justify-end -mt-2 mb-1">
        <EditLayoutToggle />
      </div>
      <DashboardGrid tiles={tiles} />
    </LayoutProvider>
  );
}

// Streamed-in section: live Alpaca positions + today's research ideas vs the
// concentration cap. Wrapped in Suspense at the call-site so the rest of the
// Sectors tab paints immediately and this card streams in once Alpaca responds.
async function LiveConcentrationSection({ mode }: { mode: AlpacaMode }) {
  const [concentration, research, sectorMap] = await Promise.all([
    loadLiveConcentration(mode),
    loadResearchLog(),
    loadSectorMap(),
  ]);
  const today = research[0];
  const ideaPreview =
    today && concentration
      ? today.ideas.map((idea) => {
          const m = idea.match(/\b([A-Z]{1,5})\b/);
          const sym = m?.[1];
          const sector = sym ? sectorMap.get(sym) ?? "Unknown" : "Unknown";
          const heldInSector = concentration.bySector.get(sector)?.length ?? 0;
          const blocked = heldInSector >= SECTOR_CAP;
          return { idea, sym, sector, heldInSector, blocked };
        })
      : [];

  return (
    <div className="space-y-5">
      <Card
        title="Live concentration"
        subtitle={`Rule #17: max ${SECTOR_CAP} open positions per GICS sector`}
      >
        {!concentration ? (
          <div className="text-sm text-[var(--color-muted)]">
            Live positions unavailable — Alpaca not configured.
          </div>
        ) : concentration.rawCount === 0 ? (
          <div className="text-sm text-[var(--color-muted)]">No open positions.</div>
        ) : (
          <table className="w-full text-sm tabular">
            <thead>
              <tr className="text-left text-[10px] uppercase tracking-[0.14em] text-[var(--color-muted)] border-b border-[rgba(255,255,255,0.08)]">
                <th className="py-2 pr-3">Sector</th>
                <th className="py-2 pr-3">Symbols</th>
                <th className="py-2 pr-3">Open / cap</th>
                <th className="py-2 pr-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {[...concentration.bySector.entries()].map(([sector, syms]) => {
                const at = syms.length === SECTOR_CAP;
                const over = syms.length > SECTOR_CAP;
                return (
                  <tr key={sector} className="border-b border-[rgba(255,255,255,0.04)]">
                    <td className="py-1.5 pr-3 font-semibold">{sector}</td>
                    <td className="py-1.5 pr-3 text-[var(--color-muted)]">
                      {syms.join(", ")}
                    </td>
                    <td className="py-1.5 pr-3">
                      {syms.length}/{SECTOR_CAP}
                    </td>
                    <td className="py-1.5 pr-3">
                      {over ? (
                        <Badge tone="down">over cap</Badge>
                      ) : at ? (
                        <Badge tone="warn">at cap</Badge>
                      ) : (
                        <Badge tone="up">room</Badge>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>

      {ideaPreview.length > 0 && (
        <Card
          title="Idea preview"
          subtitle="Today's research ideas vs. live concentration cap"
        >
          <ul className="space-y-1.5 text-sm">
            {ideaPreview.map((p, i) => (
              <li key={i} className="flex items-baseline gap-2 flex-wrap">
                <span className="text-[var(--color-text)] font-semibold">
                  {p.sym ?? "—"}
                </span>
                <span className="text-[var(--color-muted)] text-xs">
                  {p.sector} · {p.heldInSector}/{SECTOR_CAP} held
                </span>
                {p.blocked && <Badge tone="down">would be blocked</Badge>}
                <span className="text-[var(--color-muted)] truncate">{p.idea}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
