import { Card, Badge } from "@/components/ui/Card";
import { runAlpaca } from "@/lib/alpaca";
import { scopeToPair, type AlpacaScope } from "@/lib/alpacaMode";
import { loadBenchmark } from "@/lib/parsers/benchmark";
import { fmtPct } from "@/lib/format";
import { currentWeekMondayCT } from "@/lib/time";

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

// Find the most recent Monday on/before today (in CT); return that row's
// portfolio (or the earliest available if no Monday row exists).
function weekStartPortfolio(
  rows: { date: string; portfolio: number | null }[]
): number | null {
  const mondayStr = currentWeekMondayCT();
  const inWeek = rows.filter((r) => r.date >= mondayStr && r.portfolio != null);
  if (inWeek.length > 0 && inWeek[0].portfolio != null) return inWeek[0].portfolio;
  for (const r of rows) if (r.portfolio != null) return r.portfolio;
  return null;
}

export async function DrawdownBreaker({
  scope,
  botId,
}: {
  scope: AlpacaScope;
  botId?: string | null;
}) {
  let equity: number | null = null;
  let bench: Awaited<ReturnType<typeof loadBenchmark>> | null = null;
  let probeError: string | null = null;
  // Prefer the bot binding for both Alpaca call + memory ctx so a $10k slice
  // breaker reflects its own benchmark, not the env default.
  const runOpts = scopeToPair(scope);
  const memBot =
    botId ?? (scope.kind === "mode" ? scope.mode : scope.kind === "account" ? scope.accountId : "live");
  try {
    const account = (await runAlpaca("account", [], runOpts)) as AccountResp;
    equity = Number(account.equity);
    bench = await loadBenchmark({ bot: memBot });
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
  const weekStart = weekStartPortfolio(bench.rows);
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
