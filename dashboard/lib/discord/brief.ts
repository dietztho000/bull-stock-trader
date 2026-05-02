import type { EarningsEntry } from "../parsers/earningsCalendar.shared";
import type { EconomicEvent } from "../parsers/economicCalendar.shared";
import { etTimeStringToCT } from "../time";

export type BriefPosition = {
  symbol: string;
  unrealizedPlPct: number | null;
};

export type ClockState = {
  isOpen: boolean;
  nextOpen?: string;
};

export type BriefInput = {
  date: string;
  earnings: EarningsEntry[];
  economic: EconomicEvent[];
  openPositions: BriefPosition[];
  clock?: ClockState;
  phaseDay?: number | null;
};

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function fmtDateHeader(date: string): string {
  const m = date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return date;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return `${WEEKDAYS[d.getDay()]} ${date}`;
}

function importanceBadge(imp: string): string {
  if (imp === "high") return "🔴 high";
  if (imp === "medium") return "🟠 medium";
  if (imp === "low") return "⚪ low";
  return "";
}

function fmtPctSigned(v: number | null): string {
  if (v === null || !Number.isFinite(v)) return "—";
  const sign = v >= 0 ? "+" : "";
  return `${sign}${(v * 100).toFixed(1)}%`;
}

function fmtEconomicLine(e: EconomicEvent): string {
  const time = e.time ? `${etTimeStringToCT(e.time, e.date)} CT — ` : "";
  const stats: string[] = [];
  if (e.forecast) stats.push(`est ${e.forecast}`);
  if (e.previous) stats.push(`prev ${e.previous}`);
  const statSuffix = stats.length > 0 ? ` · ${stats.join(" · ")}` : "";
  const badge = importanceBadge(e.importance);
  const badgeSuffix = badge ? `  ${badge}` : "";
  return `• ${time}**${e.event}**${statSuffix}${badgeSuffix}`;
}

function fmtEarningsLine(e: EarningsEntry): string {
  const held = e.isHeld ? " 📍" : "";
  const slot = e.type ? ` ${e.type}` : "";
  const company = e.company ? ` — ${e.company}` : "";
  const eps = e.epsEstimate ? ` · est ${e.epsEstimate}` : "";
  return `• **${e.symbol}**${slot}${held}${company}${eps}`;
}

function fmtPositionLine(p: BriefPosition): string {
  return `${p.symbol} (${fmtPctSigned(p.unrealizedPlPct)})`;
}

/**
 * Pure formatter — no I/O. Returns a Discord-flavored markdown string,
 * already trimmed to under ~1800 chars (Discord's hard limit is 2000;
 * scripts/discord.sh truncates at 1900 with a notice).
 */
export function buildPreMarketBrief(input: BriefInput): string {
  const { date, earnings, economic, openPositions, clock, phaseDay } = input;

  const todayEarnings = earnings.filter((e) => e.date === date);
  const todayEconomic = economic.filter((e) => e.date === date);

  const lines: string[] = [];
  lines.push(`📊 **Pre-Market Brief — ${fmtDateHeader(date)}**`);
  const status = clock?.isOpen ? "🟢 OPEN" : "🔴 CLOSED";
  const phase = phaseDay != null ? `  ·  Phase day ${phaseDay}` : "";
  lines.push(`Market: ${status}${phase}`);
  lines.push("");

  if (todayEarnings.length > 0) {
    const heldCount = todayEarnings.filter((e) => e.isHeld).length;
    const heldSuffix = heldCount > 0 ? ` · ${heldCount} held 📍` : "";
    lines.push(`💰 **Earnings today** (${todayEarnings.length}${heldSuffix})`);
    // Sort: held first, then by symbol.
    const sorted = [...todayEarnings].sort((a, b) => {
      const ah = a.isHeld ? 0 : 1;
      const bh = b.isHeld ? 0 : 1;
      if (ah !== bh) return ah - bh;
      return a.symbol.localeCompare(b.symbol);
    });
    for (const e of sorted) lines.push(fmtEarningsLine(e));
    lines.push("");
  } else {
    lines.push("💰 **Earnings today**: none scheduled");
    lines.push("");
  }

  if (todayEconomic.length > 0) {
    lines.push(`🏛️ **Economic events today** (${todayEconomic.length})`);
    for (const e of todayEconomic) lines.push(fmtEconomicLine(e));
    const hasHigh = todayEconomic.some((e) => e.importance === "high");
    if (hasHigh) {
      lines.push("");
      lines.push("⚠️ High-impact print today — expect elevated volatility around release time.");
    }
    lines.push("");
  } else {
    lines.push("🏛️ **Economic events today**: none scheduled");
    lines.push("");
  }

  if (openPositions.length > 0) {
    lines.push(
      `📋 **Open positions to monitor**: ${openPositions.map(fmtPositionLine).join(", ")}`
    );
  }

  // Upcoming earnings (next 5 calendar days, excluding today). Held first,
  // then a small selection of major-mover names.
  const upcoming = earnings.filter((e) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(e.date)) return false;
    if (e.date <= date) return false;
    return diffDays(date, e.date) <= 5;
  });
  const upcomingHeld = upcoming.filter((e) => e.isHeld);
  const upcomingMarket = upcoming.filter((e) => !e.isHeld).slice(0, 8);
  if (upcomingHeld.length + upcomingMarket.length > 0) {
    lines.push("");
    lines.push("🗓️ **Upcoming earnings (next 5 days)**:");
    for (const e of upcomingHeld) {
      const slot = e.type ? ` ${e.type}` : "";
      const eps = e.epsEstimate ? ` · est ${e.epsEstimate}` : "";
      lines.push(`• 📍 ${e.date} — **${e.symbol}**${slot}${eps}`);
    }
    for (const e of upcomingMarket) {
      const slot = e.type ? ` ${e.type}` : "";
      const eps = e.epsEstimate ? ` · est ${e.epsEstimate}` : "";
      lines.push(`• ${e.date} — **${e.symbol}**${slot}${eps}`);
    }
  }

  let out = lines.join("\n").trim();
  // Soft cap to give discord.sh room for its emoji prefix.
  if (out.length > 1800) out = out.slice(0, 1797) + "…";
  return out;
}

function diffDays(a: string, b: string): number {
  const ma = a.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const mb = b.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!ma || !mb) return Number.POSITIVE_INFINITY;
  const da = new Date(Number(ma[1]), Number(ma[2]) - 1, Number(ma[3])).getTime();
  const db = new Date(Number(mb[1]), Number(mb[2]) - 1, Number(mb[3])).getTime();
  return Math.round((db - da) / 86_400_000);
}
