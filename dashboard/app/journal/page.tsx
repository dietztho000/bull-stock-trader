import Link from "next/link";
import { Card, Badge } from "@/components/ui/Card";
import { UrlTabs } from "@/components/ui/UrlTabs";
import { activeTab } from "@/lib/activeTab";
import { loadResearchLog } from "@/lib/parsers/researchLog";
import { loadSectorLedger } from "@/lib/parsers/sectorLedger";
import { loadWeeklyReviews } from "@/lib/parsers/weeklyReview";
import { loadDailySummaries } from "@/lib/parsers/dailySummary";
import {
  buildRoutineMatrix,
  loadRunLog,
  summarizeToday,
  type RunRecord,
} from "@/lib/parsers/runLog";
import { CrossBotRoutineGrid } from "@/components/journal/CrossBotRoutineGrid";
import { WeeklyReviewDraft } from "@/components/journal/WeeklyReviewDraft";
import { RoutineHealthPopover } from "@/components/journal/RoutineHealthPopover";
import { todayInCT, isFridayCT, fmtClockCT } from "@/lib/time";
import { fmtRelativeTime } from "@/lib/format";
import { cooldownStatus } from "@/lib/stats/cooldown";
import { resolveBotCtx } from "@/lib/resolveAccount";
import { listBots } from "@/lib/settings";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const TABS = ["research", "daily", "weekly", "routines"] as const;
type Tab = (typeof TABS)[number];

const TAB_OPTIONS: { value: Tab; label: string }[] = [
  { value: "research", label: "Research" },
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "routines", label: "Routines" },
];

export default async function JournalPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const sp = await searchParams;
  const tab = activeTab<Tab>(sp, "tab", TABS, "research");
  const ctx = await resolveBotCtx(sp);

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Journal</h1>
          <p className="text-xs text-[var(--color-muted)] mt-0.5">
            Pre-market research, Friday reviews, and the market calendar.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <RoutineHealthBadge botId={ctx.botId} strategy={ctx.strategy} />
          <UrlTabs<Tab> layoutId="journal-tabs" options={TAB_OPTIONS} fallback="research" />
        </div>
      </header>

      {tab === "research" && <ResearchTab botId={ctx.botId} strategy={ctx.strategy} />}
      {tab === "daily" && <DailyTab />}
      {tab === "weekly" && <WeeklyTab botId={ctx.botId} strategy={ctx.strategy} />}
      {tab === "routines" && <RoutinesTab botId={ctx.botId} strategy={ctx.strategy} />}
    </div>
  );
}

/** Surfaces the time since the latest RUN-LOG.jsonl entry as a clickable
 *  pill that opens a per-routine breakdown popover. Catches the failure
 *  mode where the dashboard reads a frozen per-bot file because cloud
 *  routines stopped pushing — and lets the user spot WHICH specific
 *  routine missed at a glance. Audit B drill-down. */
async function RoutineHealthBadge({
  botId,
  strategy,
}: {
  botId: string;
  strategy: string;
}) {
  const runs = await loadRunLog({ bot: botId, strategy });
  const today = todayInCT();
  const summary = summarizeToday(runs, today, isFridayCT(today));

  let latestTs: number | null = null;
  for (const r of runs) {
    const ts = r.endTs ?? r.startTs;
    if (!ts) continue;
    const ms = Date.parse(ts);
    if (!Number.isFinite(ms)) continue;
    if (latestTs == null || ms > latestTs) latestTs = ms;
  }

  const popoverRoutines = summary.map((s) => {
    const lastRun = s.lastRun;
    let status: "ok" | "error" | "unknown" | "missing" = "missing";
    if (lastRun) {
      if (lastRun.status === "error") status = "error";
      else if (lastRun.endTs == null) status = "unknown";
      else status = "ok";
    }
    return {
      routine: s.routine,
      startTs: lastRun?.startTs ?? null,
      endTs: lastRun?.endTs ?? null,
      status,
    };
  });

  return (
    <RoutineHealthPopover
      latestTs={latestTs}
      routines={popoverRoutines}
      todayCT={today}
    />
  );
}

function extractTicker(idea: string): string | null {
  const m = idea.match(/^([A-Z]{1,5})\b/);
  return m?.[1] ?? null;
}

async function ResearchTab({ botId, strategy }: { botId: string; strategy: string }) {
  const [entries, ledger] = await Promise.all([
    loadResearchLog({ bot: botId, strategy }),
    loadSectorLedger({ bot: botId, strategy }),
  ]);
  const todayDate = entries[0]?.date;

  if (entries.length === 0) {
    return (
      <Card title="No entries yet">
        <div className="text-sm text-[var(--color-muted)]">
          Pre-market research will appear here once the bot starts running its 6 AM
          routine.
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {entries.map((e) => {
        const isToday = e.date === todayDate;
        return (
          <Card
            key={e.date}
            title={e.date}
            right={
              e.decision ? (
                <Badge
                  tone={
                    /TRADE/i.test(e.decision)
                      ? "up"
                      : /HOLD/i.test(e.decision)
                      ? "neutral"
                      : "warn"
                  }
                >
                  {e.decision}
                </Badge>
              ) : null
            }
          >
            {e.ideas.length > 0 && (
              <div className="mb-3">
                <div className="text-[10px] uppercase tracking-[0.14em] text-[var(--color-muted)] font-medium mb-2">
                  Ideas
                </div>
                <ul className="text-sm space-y-1.5">
                  {e.ideas.map((idea, idx) => {
                    const ticker = extractTicker(idea);
                    const cd =
                      isToday && ticker
                        ? cooldownStatus(ticker, ledger.closed, e.date)
                        : null;
                    const blocked = cd?.blocked ?? false;
                    return (
                      <li
                        key={idx}
                        className={
                          blocked
                            ? "line-through text-[var(--color-muted)]"
                            : "text-[var(--color-text)]"
                        }
                      >
                        <span className="text-[var(--color-muted)] mr-2">·</span>
                        <span>{idea}</span>
                        {ticker && (
                          <>
                            <Link
                              href={`/calendar?focus=${encodeURIComponent(ticker)}`}
                              className="ml-2 text-[10px] text-[var(--color-muted)] hover:text-[var(--color-accent)]"
                              title={`Show ${ticker} earnings on calendar`}
                            >
                              📅
                            </Link>
                            {!blocked && (
                              <Link
                                href={`/?prefill=${encodeURIComponent(ticker)}&score=7`}
                                className="ml-1.5 text-[10px] text-[var(--color-muted)] hover:text-[var(--color-accent)]"
                                title={`Pre-fill order entry with ${ticker}`}
                              >
                                💼 Trade
                              </Link>
                            )}
                          </>
                        )}
                        {blocked && cd && (
                          <span className="ml-2 inline-flex items-baseline gap-1.5">
                            <Badge tone="down">
                              Cooldown: stopped {cd.lastLossDate}, {cd.daysRemaining}d
                              remaining
                            </Badge>
                          </span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
            <details className="text-xs">
              <summary className="cursor-pointer text-[var(--color-muted)] hover:text-[var(--color-accent)]">
                Full entry
              </summary>
              <pre className="whitespace-pre-wrap mt-2 leading-relaxed text-[var(--color-text)]">
                {e.body}
              </pre>
            </details>
          </Card>
        );
      })}
    </div>
  );
}

async function WeeklyTab({ botId, strategy }: { botId: string; strategy: string }) {
  const reviews = await loadWeeklyReviews({ bot: botId, strategy });
  if (reviews.length === 0) {
    return (
      <div className="space-y-4">
        <WeeklyReviewDraft botId={botId} />
        <Card title="No reviews yet">
          <div className="text-sm text-[var(--color-muted)]">
            Weekly reviews land Friday afternoon after the /weekly-review routine.
            Use the draft generator above to start a week early.
          </div>
        </Card>
      </div>
    );
  }
  return (
    <div className="space-y-4">
      <WeeklyReviewDraft botId={botId} />
      {reviews.map((r) => (
        <Card
          key={r.weekEnding}
          title={`Week ending ${r.weekEnding}`}
          right={
            r.grade ? (
              <Badge tone={/A/i.test(r.grade) ? "up" : "neutral"}>Grade {r.grade}</Badge>
            ) : null
          }
        >
          {Object.keys(r.stats).length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-1 text-sm mb-3">
              {Object.entries(r.stats).map(([k, v]) => (
                <div
                  key={k}
                  className="flex justify-between border-b border-[rgba(255,255,255,0.04)] py-1"
                >
                  <span className="text-[var(--color-muted)]">{k}</span>
                  <span className="tabular">{v}</span>
                </div>
              ))}
            </div>
          )}
          <details className="text-xs">
            <summary className="cursor-pointer text-[var(--color-muted)] hover:text-[var(--color-accent)]">
              Full review
            </summary>
            <pre className="whitespace-pre-wrap mt-2 leading-relaxed text-[var(--color-text)]">
              {r.body}
            </pre>
          </details>
        </Card>
      ))}
    </div>
  );
}

async function DailyTab() {
  const summaries = await loadDailySummaries();
  if (summaries.length === 0) {
    return (
      <Card title="No daily summaries yet">
        <div className="text-sm text-[var(--color-muted)]">
          The /daily-summary routine appends an entry after each trading day.
        </div>
      </Card>
    );
  }
  return (
    <div className="space-y-4">
      {summaries.map((s, i) => (
        <Card
          key={`${s.timestamp}-${i}`}
          title={s.timestamp}
          right={s.note ? <Badge tone="warn">{s.note}</Badge> : null}
        >
          <pre className="whitespace-pre-wrap text-sm leading-relaxed text-[var(--color-text)]">
            {s.body}
          </pre>
        </Card>
      ))}
    </div>
  );
}

function fmtDuration(ms: number | null): string {
  if (ms == null) return "—";
  if (ms < 1000) return `${ms}ms`;
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  return `${m}m ${s % 60}s`;
}

function fmtRunClock(ts: string | null): string {
  if (!ts) return "—";
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return "—";
  return fmtClockCT(d);
}

function statusTone(run: RunRecord | null): "up" | "down" | "warn" | "neutral" {
  if (!run) return "warn";
  if (run.status === "error") return "down";
  if (run.endTs == null) return "warn";
  return "up";
}

function statusLabel(run: RunRecord | null): string {
  if (!run) return "missed";
  if (run.status === "error") return "error";
  if (run.endTs == null) return "in flight";
  return "ok";
}

async function RoutinesTab({ botId, strategy }: { botId: string; strategy: string }) {
  const todayCT = todayInCT();
  const isFriday = isFridayCT(todayCT);

  // Active bot's data drives the existing per-routine table + recent runs.
  // The cross-bot matrix that follows pulls every enabled bot's RUN-LOG so
  // the user can spot a single routine failing across multiple bots without
  // toggling the dropdown — audit F6.
  const enabledBots = (await listBots()).filter((b) => b.enabled);
  const perBotRuns = await Promise.all(
    enabledBots.map(async (b) => ({
      bot: b,
      runs: await loadRunLog({ bot: b.id, strategy: b.strategySlug }),
    }))
  );

  const activeRuns =
    perBotRuns.find((p) => p.bot.id === botId)?.runs ??
    (await loadRunLog({ bot: botId, strategy }));
  const today = summarizeToday(activeRuns, todayCT, isFriday);

  const firedCount = today.filter((r) => r.lastRun != null).length;
  const errorCount = today.filter((r) => r.lastRun?.status === "error").length;
  const expectedCount = today.length;

  const recent = activeRuns.slice(0, 50);
  const lastSyncMs = activeRuns[0]?.endTs
    ? Date.parse(activeRuns[0].endTs)
    : activeRuns[0]?.startTs
    ? Date.parse(activeRuns[0].startTs)
    : null;

  const matrix =
    perBotRuns.length > 1
      ? buildRoutineMatrix(
          perBotRuns.map((p) => ({ botId: p.bot.id, runs: p.runs })),
          todayCT,
          isFriday
        )
      : null;

  return (
    <div className="space-y-4">
      {matrix && (
        <CrossBotRoutineGrid
          todayCT={todayCT}
          routines={matrix.routines}
          columns={matrix.columns}
          botNames={Object.fromEntries(perBotRuns.map((p) => [p.bot.id, p.bot.name]))}
        />
      )}

      <Card
        title={`Today's routines — ${todayCT}`}
        subtitle={`${firedCount}/${expectedCount} fired${
          errorCount ? ` · ${errorCount} error${errorCount === 1 ? "" : "s"}` : ""
        }${lastSyncMs ? ` · last activity ${fmtRelativeTime(lastSyncMs)} ago` : ""}`}
      >
        <table className="w-full text-sm tabular">
          <thead>
            <tr className="text-left text-[10px] uppercase tracking-[0.14em] text-[var(--color-muted)] border-b border-[rgba(255,255,255,0.08)]">
              <th className="py-2 pr-3">Routine</th>
              <th className="py-2 pr-3">Status</th>
              <th className="py-2 pr-3">Started (CT)</th>
              <th className="py-2 pr-3">Ended (CT)</th>
              <th className="py-2 pr-3">Duration</th>
              <th className="py-2 pr-3">Commit</th>
            </tr>
          </thead>
          <tbody>
            {today.map((r) => (
              <tr
                key={r.routine}
                className="border-b border-[rgba(255,255,255,0.04)]"
              >
                <td className="py-1.5 pr-3 font-semibold">{r.routine}</td>
                <td className="py-1.5 pr-3">
                  <Badge tone={statusTone(r.lastRun)}>
                    {statusLabel(r.lastRun)}
                  </Badge>
                </td>
                <td className="py-1.5 pr-3 text-[var(--color-muted)]">
                  {fmtRunClock(r.lastRun?.startTs ?? null)}
                </td>
                <td className="py-1.5 pr-3 text-[var(--color-muted)]">
                  {fmtRunClock(r.lastRun?.endTs ?? null)}
                </td>
                <td className="py-1.5 pr-3">
                  {fmtDuration(r.lastRun?.durationMs ?? null)}
                </td>
                <td className="py-1.5 pr-3 text-[var(--color-muted)] font-mono text-[11px]">
                  {r.lastRun?.gitSha?.slice(0, 7) ?? "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Card
        title="Recent runs"
        subtitle={`Last ${recent.length} routine fires across all days`}
      >
        {recent.length === 0 ? (
          <div className="text-sm text-[var(--color-muted)]">
            No runs yet — RUN-LOG.jsonl is empty.
          </div>
        ) : (
          <table className="w-full text-sm tabular">
            <thead>
              <tr className="text-left text-[10px] uppercase tracking-[0.14em] text-[var(--color-muted)] border-b border-[rgba(255,255,255,0.08)]">
                <th className="py-2 pr-3">Routine</th>
                <th className="py-2 pr-3">Status</th>
                <th className="py-2 pr-3">When</th>
                <th className="py-2 pr-3">Duration</th>
                <th className="py-2 pr-3">Commit</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((r, i) => {
                const stamp = r.endTs ?? r.startTs;
                const ageMs = stamp ? Date.parse(stamp) : NaN;
                return (
                  <tr
                    key={`${r.routine}-${stamp}-${i}`}
                    className="border-b border-[rgba(255,255,255,0.04)]"
                  >
                    <td className="py-1.5 pr-3 font-semibold">{r.routine}</td>
                    <td className="py-1.5 pr-3">
                      <Badge tone={statusTone(r)}>{statusLabel(r)}</Badge>
                    </td>
                    <td
                      className="py-1.5 pr-3 text-[var(--color-muted)]"
                      title={stamp ?? ""}
                    >
                      {Number.isFinite(ageMs)
                        ? `${fmtRelativeTime(ageMs)} ago`
                        : "—"}
                    </td>
                    <td className="py-1.5 pr-3">
                      {fmtDuration(r.durationMs)}
                    </td>
                    <td className="py-1.5 pr-3 text-[var(--color-muted)] font-mono text-[11px]">
                      {r.gitSha?.slice(0, 7) ?? "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
