import type { LayoutItem, ResponsiveLayouts } from "react-grid-layout/legacy";

// 12-col grid at lg/md, 6 at sm, 4 at xs, 2 at xxs.
// rowHeight is 48px in DashboardGrid, so h:1 ≈ 48px tall (plus margin).

type TileMeta = { id: string; title: string };

export type PageLayoutSpec = {
  tiles: TileMeta[];
  defaults: ResponsiveLayouts;
};

// Helper: build single-column layout for narrow breakpoints.
function stack(items: { i: string; h: number }[], cols: number): LayoutItem[] {
  let y = 0;
  return items.map((it) => {
    const item = { i: it.i, x: 0, y, w: cols, h: it.h, minW: 1, minH: 2 };
    y += it.h;
    return item;
  });
}

// ───────────────────────── Overview ─────────────────────────
// Lives in components/layout/overview/registry.tsx (each tile declares its
// own size + render fn). Re-export here only as a type so other layouts can
// reference the shape; the page imports OVERVIEW_LAYOUT directly from the
// registry to avoid pulling Overview tile components into Trades/Analytics
// bundles.

// ───────────────────────── Analytics: Curve ─────────────────────────
const analyticsCurveItems = [
  { i: "live-snapshot", h: 4 },
  { i: "kpi-days", h: 3 },
  { i: "kpi-max-dd", h: 3 },
  { i: "kpi-dd-trough", h: 3 },
  { i: "kpi-recovery", h: 3 },
  { i: "equity-curve", h: 9 },
  { i: "drawdown", h: 7 },
  { i: "alpha", h: 7 },
  { i: "daily-return-dist", h: 7 },
  { i: "calendar-heatmap", h: 7 },
];

export const ANALYTICS_CURVE_LAYOUT: PageLayoutSpec = {
  tiles: [
    { id: "live-snapshot", title: "Live Alpaca snapshot" },
    { id: "kpi-days", title: "Days recorded" },
    { id: "kpi-max-dd", title: "Max drawdown" },
    { id: "kpi-dd-trough", title: "DD trough" },
    { id: "kpi-recovery", title: "Recovery" },
    { id: "equity-curve", title: "Equity curve" },
    { id: "drawdown", title: "Drawdown" },
    { id: "alpha", title: "Alpha" },
    { id: "daily-return-dist", title: "Daily return distribution" },
    { id: "calendar-heatmap", title: "Daily P&L calendar" },
  ],
  defaults: {
    lg: [
      { i: "live-snapshot", x: 0, y: 0, w: 12, h: 4, minW: 4, minH: 3 },
      { i: "kpi-days", x: 0, y: 4, w: 3, h: 3, minW: 2, minH: 2 },
      { i: "kpi-max-dd", x: 3, y: 4, w: 3, h: 3, minW: 2, minH: 2 },
      { i: "kpi-dd-trough", x: 6, y: 4, w: 3, h: 3, minW: 2, minH: 2 },
      { i: "kpi-recovery", x: 9, y: 4, w: 3, h: 3, minW: 2, minH: 2 },
      { i: "equity-curve", x: 0, y: 7, w: 12, h: 9, minW: 4, minH: 5 },
      { i: "drawdown", x: 0, y: 16, w: 12, h: 7, minW: 4, minH: 4 },
      { i: "alpha", x: 0, y: 23, w: 12, h: 7, minW: 4, minH: 4 },
      { i: "daily-return-dist", x: 0, y: 30, w: 6, h: 7, minW: 3, minH: 4 },
      { i: "calendar-heatmap", x: 6, y: 30, w: 6, h: 7, minW: 3, minH: 4 },
    ],
    md: [
      { i: "live-snapshot", x: 0, y: 0, w: 12, h: 4, minW: 4, minH: 3 },
      { i: "kpi-days", x: 0, y: 4, w: 3, h: 3, minW: 2, minH: 2 },
      { i: "kpi-max-dd", x: 3, y: 4, w: 3, h: 3, minW: 2, minH: 2 },
      { i: "kpi-dd-trough", x: 6, y: 4, w: 3, h: 3, minW: 2, minH: 2 },
      { i: "kpi-recovery", x: 9, y: 4, w: 3, h: 3, minW: 2, minH: 2 },
      { i: "equity-curve", x: 0, y: 7, w: 12, h: 9, minW: 4, minH: 5 },
      { i: "drawdown", x: 0, y: 16, w: 12, h: 7, minW: 4, minH: 4 },
      { i: "alpha", x: 0, y: 23, w: 12, h: 7, minW: 4, minH: 4 },
      { i: "daily-return-dist", x: 0, y: 30, w: 12, h: 7, minW: 3, minH: 4 },
      { i: "calendar-heatmap", x: 0, y: 37, w: 12, h: 7, minW: 3, minH: 4 },
    ],
    sm: stack(analyticsCurveItems, 6),
    xs: stack(analyticsCurveItems, 4),
    xxs: stack(analyticsCurveItems, 2),
  },
};

// ───────────────────────── Analytics: Risk ─────────────────────────
// Each KPI is its own grid tile (parity with Overview). Cards from the
// previous version (Risk-adjusted / Drawdown / Daily returns / Trades /
// Discipline) flatten to 28 individual KPI tiles. Per-KPI labels carry
// what the category labels used to communicate.
const riskKpis: { id: string; title: string }[] = [
  { id: "kpi-sharpe", title: "Sharpe" },
  { id: "kpi-sortino", title: "Sortino" },
  { id: "kpi-calmar", title: "Calmar" },
  { id: "kpi-ann-return", title: "Annualized return" },
  { id: "kpi-max-dd", title: "Max drawdown" },
  { id: "kpi-peak-date", title: "Peak date" },
  { id: "kpi-trough-date", title: "Trough date" },
  { id: "kpi-recovery", title: "Recovery" },
  { id: "kpi-mean", title: "Mean (daily)" },
  { id: "kpi-stddev", title: "Std dev (daily)" },
  { id: "kpi-best-day", title: "Best day" },
  { id: "kpi-worst-day", title: "Worst day" },
  { id: "kpi-closed", title: "Closed" },
  { id: "kpi-winrate", title: "Win rate" },
  { id: "kpi-profit-factor", title: "Profit factor" },
  { id: "kpi-payoff", title: "Payoff ratio" },
  { id: "kpi-avg-win", title: "Avg win" },
  { id: "kpi-avg-loss", title: "Avg loss" },
  { id: "kpi-expectancy", title: "Expectancy" },
  { id: "kpi-avg-r", title: "Avg R-multiple" },
  { id: "kpi-stop-discipline", title: "Stop discipline" },
  { id: "kpi-trades-per-week", title: "Trades per week" },
  { id: "kpi-best-month", title: "Best month" },
  { id: "kpi-worst-month", title: "Worst month" },
  { id: "kpi-longest-win-streak", title: "Longest win streak" },
  { id: "kpi-longest-loss-streak", title: "Longest loss streak" },
  { id: "kpi-best-trade", title: "Best trade" },
  { id: "kpi-worst-trade", title: "Worst trade" },
];

// Lay out KPIs in 4-column rows (each w:3, h:3) on lg/md.
function riskKpiRows(): LayoutItem[] {
  return riskKpis.map((k, idx) => ({
    i: k.id,
    x: (idx % 4) * 3,
    y: Math.floor(idx / 4) * 3,
    w: 3,
    h: 3,
    minW: 2,
    minH: 2,
  }));
}

const riskKpiRowsHeight = Math.ceil(riskKpis.length / 4) * 3; // = 21

const analyticsRiskItems = [
  ...riskKpis.map((k) => ({ i: k.id, h: 3 })),
  { i: "r-distribution", h: 7 },
  { i: "daily-distribution", h: 7 },
  { i: "scorer-table", h: 6 },
];

export const ANALYTICS_RISK_LAYOUT: PageLayoutSpec = {
  tiles: [
    ...riskKpis.map((k) => ({ id: k.id, title: k.title })),
    { id: "r-distribution", title: "R-multiple distribution" },
    { id: "daily-distribution", title: "Daily returns distribution" },
    { id: "scorer-table", title: "Win rate by entry-scorer bucket" },
  ],
  defaults: {
    lg: [
      ...riskKpiRows(),
      { i: "r-distribution", x: 0, y: riskKpiRowsHeight, w: 6, h: 7, minW: 3, minH: 4 },
      { i: "daily-distribution", x: 6, y: riskKpiRowsHeight, w: 6, h: 7, minW: 3, minH: 4 },
      { i: "scorer-table", x: 0, y: riskKpiRowsHeight + 7, w: 12, h: 6, minW: 4, minH: 4 },
    ],
    md: [
      ...riskKpiRows(),
      { i: "r-distribution", x: 0, y: riskKpiRowsHeight, w: 12, h: 7, minW: 3, minH: 4 },
      { i: "daily-distribution", x: 0, y: riskKpiRowsHeight + 7, w: 12, h: 7, minW: 3, minH: 4 },
      { i: "scorer-table", x: 0, y: riskKpiRowsHeight + 14, w: 12, h: 6, minW: 4, minH: 4 },
    ],
    sm: stack(analyticsRiskItems, 6),
    xs: stack(analyticsRiskItems, 4),
    xxs: stack(analyticsRiskItems, 2),
  },
};

// ───────────────────────── Analytics: Backtest ─────────────────────────
// Layout supports two render paths: (a) summary present → 4 KPIs + reason
// breakdown + cumulative + per-trade; (b) summary null → empty-state Card
// at the "summary" slot. RGL skips layout entries with no matching child,
// so unused tiles (KPIs in path b, "summary" in path a) don't render.
// `summary` shares y:3 with the KPIs row — only one path is rendered at a
// time, so they never collide on screen.
const analyticsBacktestItems = [
  { i: "header", h: 3 },
  { i: "kpi-trades", h: 3 },
  { i: "kpi-actual", h: 3 },
  { i: "kpi-sim", h: 3 },
  { i: "kpi-delta", h: 3 },
  { i: "summary", h: 5 },
  { i: "reason-breakdown", h: 4 },
  { i: "cumulative", h: 8 },
  { i: "per-trade", h: 9 },
];

export const ANALYTICS_BACKTEST_LAYOUT: PageLayoutSpec = {
  tiles: [
    { id: "header", title: "Backtest header" },
    { id: "kpi-trades", title: "Trades replayed" },
    { id: "kpi-actual", title: "Actual P&L" },
    { id: "kpi-sim", title: "Sim P&L" },
    { id: "kpi-delta", title: "Delta (sim − actual)" },
    { id: "summary", title: "Backtest summary" },
    { id: "reason-breakdown", title: "Exit reason breakdown" },
    { id: "cumulative", title: "Cumulative P&L" },
    { id: "per-trade", title: "Per-trade comparison" },
  ],
  defaults: {
    lg: [
      { i: "header", x: 0, y: 0, w: 12, h: 3, minW: 4, minH: 2 },
      { i: "kpi-trades", x: 0, y: 3, w: 3, h: 3, minW: 2, minH: 2 },
      { i: "kpi-actual", x: 3, y: 3, w: 3, h: 3, minW: 2, minH: 2 },
      { i: "kpi-sim", x: 6, y: 3, w: 3, h: 3, minW: 2, minH: 2 },
      { i: "kpi-delta", x: 9, y: 3, w: 3, h: 3, minW: 2, minH: 2 },
      { i: "summary", x: 0, y: 3, w: 12, h: 5, minW: 4, minH: 3 },
      { i: "reason-breakdown", x: 0, y: 6, w: 12, h: 4, minW: 4, minH: 3 },
      { i: "cumulative", x: 0, y: 10, w: 12, h: 8, minW: 4, minH: 5 },
      { i: "per-trade", x: 0, y: 18, w: 12, h: 9, minW: 4, minH: 5 },
    ],
    md: [
      { i: "header", x: 0, y: 0, w: 12, h: 3, minW: 4, minH: 2 },
      { i: "kpi-trades", x: 0, y: 3, w: 3, h: 3, minW: 2, minH: 2 },
      { i: "kpi-actual", x: 3, y: 3, w: 3, h: 3, minW: 2, minH: 2 },
      { i: "kpi-sim", x: 6, y: 3, w: 3, h: 3, minW: 2, minH: 2 },
      { i: "kpi-delta", x: 9, y: 3, w: 3, h: 3, minW: 2, minH: 2 },
      { i: "summary", x: 0, y: 3, w: 12, h: 5, minW: 4, minH: 3 },
      { i: "reason-breakdown", x: 0, y: 6, w: 12, h: 4, minW: 4, minH: 3 },
      { i: "cumulative", x: 0, y: 10, w: 12, h: 8, minW: 4, minH: 5 },
      { i: "per-trade", x: 0, y: 18, w: 12, h: 9, minW: 4, minH: 5 },
    ],
    sm: stack(analyticsBacktestItems, 6),
    xs: stack(analyticsBacktestItems, 4),
    xxs: stack(analyticsBacktestItems, 2),
  },
};

// ───────────────────────── Trades: All ─────────────────────────
// Shared KPI rows split into individual tiles for parity with Overview.
// At 12 cols: first four KPIs at w:2, profit-factor at w:4 to fill the row.
const tradesKpiItems = [
  { i: "kpi-closed", h: 3 },
  { i: "kpi-winrate", h: 3 },
  { i: "kpi-pnl", h: 3 },
  { i: "kpi-avg-r", h: 3 },
  { i: "kpi-profit-factor", h: 3 },
];

const tradesKpiLayout = [
  { i: "kpi-closed", x: 0, y: 0, w: 2, h: 3, minW: 2, minH: 2 },
  { i: "kpi-winrate", x: 2, y: 0, w: 2, h: 3, minW: 2, minH: 2 },
  { i: "kpi-pnl", x: 4, y: 0, w: 2, h: 3, minW: 2, minH: 2 },
  { i: "kpi-avg-r", x: 6, y: 0, w: 2, h: 3, minW: 2, minH: 2 },
  { i: "kpi-profit-factor", x: 8, y: 0, w: 4, h: 3, minW: 2, minH: 2 },
];

const tradesAllItems = [
  ...tradesKpiItems,
  { i: "table", h: 10 },
  { i: "distributions", h: 4 },
  { i: "best-worst", h: 4 },
];

export const TRADES_ALL_LAYOUT: PageLayoutSpec = {
  tiles: [
    { id: "kpi-closed", title: "Closed trades" },
    { id: "kpi-winrate", title: "Win rate" },
    { id: "kpi-pnl", title: "Realized P&L" },
    { id: "kpi-avg-r", title: "Avg R" },
    { id: "kpi-profit-factor", title: "Profit factor" },
    { id: "table", title: "All closed trades" },
    { id: "distributions", title: "Distributions" },
    { id: "best-worst", title: "Best and worst" },
  ],
  defaults: {
    lg: [
      ...tradesKpiLayout,
      { i: "table", x: 0, y: 3, w: 12, h: 10, minW: 4, minH: 5 },
      { i: "distributions", x: 0, y: 13, w: 12, h: 4, minW: 4, minH: 2 },
      { i: "best-worst", x: 0, y: 17, w: 12, h: 4, minW: 4, minH: 3 },
    ],
    md: [
      ...tradesKpiLayout,
      { i: "table", x: 0, y: 3, w: 12, h: 10, minW: 4, minH: 5 },
      { i: "distributions", x: 0, y: 13, w: 12, h: 4, minW: 4, minH: 2 },
      { i: "best-worst", x: 0, y: 17, w: 12, h: 4, minW: 4, minH: 3 },
    ],
    sm: stack(tradesAllItems, 6),
    xs: stack(tradesAllItems, 4),
    xxs: stack(tradesAllItems, 2),
  },
};

// ───────────────────────── Trades: Sectors ─────────────────────────
const tradesSectorsItems = [
  ...tradesKpiItems,
  { i: "live-concentration", h: 7 },
  { i: "streak-status", h: 7 },
  { i: "pnl-by-sector", h: 7 },
  { i: "per-sector-stats", h: 8 },
];

export const TRADES_SECTORS_LAYOUT: PageLayoutSpec = {
  tiles: [
    { id: "kpi-closed", title: "Closed trades" },
    { id: "kpi-winrate", title: "Win rate" },
    { id: "kpi-pnl", title: "Realized P&L" },
    { id: "kpi-avg-r", title: "Avg R" },
    { id: "kpi-profit-factor", title: "Profit factor" },
    { id: "live-concentration", title: "Live concentration" },
    { id: "streak-status", title: "Sector streak status" },
    { id: "pnl-by-sector", title: "Realized P&L by sector" },
    { id: "per-sector-stats", title: "Per-sector stats" },
  ],
  defaults: {
    lg: [
      ...tradesKpiLayout,
      { i: "live-concentration", x: 0, y: 3, w: 12, h: 7, minW: 4, minH: 4 },
      { i: "streak-status", x: 0, y: 10, w: 12, h: 7, minW: 4, minH: 4 },
      { i: "pnl-by-sector", x: 0, y: 17, w: 12, h: 7, minW: 4, minH: 4 },
      { i: "per-sector-stats", x: 0, y: 24, w: 12, h: 8, minW: 4, minH: 5 },
    ],
    md: [
      ...tradesKpiLayout,
      { i: "live-concentration", x: 0, y: 3, w: 12, h: 7, minW: 4, minH: 4 },
      { i: "streak-status", x: 0, y: 10, w: 12, h: 7, minW: 4, minH: 4 },
      { i: "pnl-by-sector", x: 0, y: 17, w: 12, h: 7, minW: 4, minH: 4 },
      { i: "per-sector-stats", x: 0, y: 24, w: 12, h: 8, minW: 4, minH: 5 },
    ],
    sm: stack(tradesSectorsItems, 6),
    xs: stack(tradesSectorsItems, 4),
    xxs: stack(tradesSectorsItems, 2),
  },
};

// ───────────────────────── Registry ─────────────────────────
// Overview lives in components/layout/overview/registry.tsx — page imports
// it directly to keep tile components out of unrelated bundles.
export const PAGE_LAYOUTS: Record<string, PageLayoutSpec> = {
  "analytics:curve": ANALYTICS_CURVE_LAYOUT,
  "analytics:risk": ANALYTICS_RISK_LAYOUT,
  "analytics:backtest": ANALYTICS_BACKTEST_LAYOUT,
  "trades:all": TRADES_ALL_LAYOUT,
  "trades:sectors": TRADES_SECTORS_LAYOUT,
};
