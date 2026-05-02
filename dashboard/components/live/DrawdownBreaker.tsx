import { Card, Badge } from "@/components/ui/Card";
import { runAlpaca, type AlpacaMode } from "@/lib/alpaca";
import { loadBenchmark } from "@/lib/parsers/benchmark";
import { fmtPct } from "@/lib/format";

const DAY_LIMIT = -2.0;   // percent
const WEEK_LIMIT = -4.0;  // percent

type AccountResp = { equity: string };

// Returns the most recent BENCHMARK row strictly before `today`.
function lastEodPortfolio(rows: { date: string; portfolio: number | null }[]): number | null {
  for (let i = rows.length - 1; i >= 0; i--) {
    if (rows[i].portfolio != null) return rows[i].portfolio;
  }
  return null;
}

// Find the most recent Monday on/before today; return that row's portfolio
// (or the earliest available if no Monday row exists).
function weekStartPortfolio(
  rows: { date: string; portfolio: number | null }[],
  today: Date
): number | null {
  const t0 = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const monday = new Date(t0);
  const dow = monday.getDay(); // 0 Sun .. 6 Sat
  const diff = dow === 0 ? -6 : 1 - dow;
  monday.setDate(monday.getDate() + diff);
  const mondayStr = monday.toISOString().slice(0, 10);
  // Look for the last row with date >= monday; fall back to earliest.
  const inWeek = rows.filter((r) => r.date >= mondayStr && r.portfolio != null);
  if (inWeek.length > 0 && inWeek[0].portfolio != null) return inWeek[0].portfolio;
  for (const r of rows) if (r.portfolio != null) return r.portfolio;
  return null;
}

export async function DrawdownBreaker({ mode }: { mode: AlpacaMode }) {
  let equity: number | null = null;
  let bench: Awaited<ReturnType<typeof loadBenchmark>> | null = null;
  let probeError: string | null = null;
  try {
    const account = (await runAlpaca("account", [], { mode })) as AccountResp;
    equity = Number(account.equity);
    bench = await loadBenchmark();
  } catch (err) {
    probeError = err instanceof Error ? err.message : String(err);
  }

  if (probeError || equity == null || !bench) {
    return (
      <Card title="Drawdown circuit breaker">
        <div className="text-xs text-[var(--color-muted)]">
          Unavailable — {probeError ?? "no benchmark data"}
        </div>
      </Card>
    );
  }

  const yesterday = lastEodPortfolio(bench.rows);
  const weekStart = weekStartPortfolio(bench.rows, new Date());
  const dayPct = yesterday ? ((equity - yesterday) / yesterday) * 100 : null;
  const weekPct = weekStart ? ((equity - weekStart) / weekStart) * 100 : null;

  const dayTripped = dayPct != null && dayPct < DAY_LIMIT;
  const weekTripped = weekPct != null && weekPct < WEEK_LIMIT;
  const tripped = dayTripped || weekTripped;

  return (
    <Card
      title="Drawdown circuit breaker"
      right={
        tripped ? (
          <Badge tone="down">🛑 Tripped — no new entries</Badge>
        ) : (
          <Badge tone="up">✓ Armed</Badge>
        )
      }
    >
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <div className="text-[11px] uppercase tracking-wider text-[var(--color-muted)]">
            Day P&amp;L
          </div>
          <div
            className={
              dayTripped
                ? "text-[var(--color-down)] font-semibold"
                : "text-[var(--color-text)]"
            }
          >
            {dayPct != null ? fmtPct(dayPct) : "—"}{" "}
            <span className="text-[var(--color-muted)] text-xs">
              limit {DAY_LIMIT.toFixed(1)}%
            </span>
          </div>
        </div>
        <div>
          <div className="text-[11px] uppercase tracking-wider text-[var(--color-muted)]">
            Week P&amp;L
          </div>
          <div
            className={
              weekTripped
                ? "text-[var(--color-down)] font-semibold"
                : "text-[var(--color-text)]"
            }
          >
            {weekPct != null ? fmtPct(weekPct) : "—"}{" "}
            <span className="text-[var(--color-muted)] text-xs">
              limit {WEEK_LIMIT.toFixed(1)}%
            </span>
          </div>
        </div>
      </div>
      {tripped && (
        <div className="mt-2 text-xs text-[var(--color-down)]">
          Bot will refuse all new entries today (rule #14). Re-arms automatically tomorrow.
        </div>
      )}
    </Card>
  );
}
