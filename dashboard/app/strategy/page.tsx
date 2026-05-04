import Link from "next/link";
import { readMemory } from "@/lib/memoryPath";
import { resolveBotCtx } from "@/lib/resolveAccount";
import { listBots } from "@/lib/settings";
import { diffLines, summarizeDiff } from "@/lib/diff";
import { StrategyCompareView } from "@/components/strategy/StrategyCompareView";
import { marked } from "marked";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type SP = { [key: string]: string | string[] | undefined };

function pickFirst(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

export default async function StrategyPage({
  searchParams,
}: {
  searchParams: Promise<SP>;
}) {
  const sp = await searchParams;
  const { botId, strategy } = await resolveBotCtx(sp);
  const compareIdRaw = pickFirst(sp.compare);

  const bots = await listBots();
  const compareBot = compareIdRaw
    ? bots.find((b) => b.id === compareIdRaw && b.id !== botId)
    : null;

  // Compare mode (audit F9): two bots' TRADING-STRATEGY.md side-by-side
  // with rule-level diff. Falls through to single-bot read when no
  // compare target or the target id is invalid.
  if (compareBot) {
    const [leftMd, rightMd] = await Promise.all([
      readMemory("TRADING-STRATEGY.md", { bot: botId, strategy }),
      readMemory("TRADING-STRATEGY.md", {
        bot: compareBot.id,
        strategy: compareBot.strategySlug,
      }),
    ]);
    const lines = diffLines(leftMd, rightMd);
    const summary = summarizeDiff(lines);
    return (
      <div className="space-y-5">
        <header className="flex flex-wrap items-baseline justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Strategy diff
            </h1>
            <p className="text-xs text-[var(--color-muted)] mt-0.5">
              <code className="font-mono">{botId}</code> ↔{" "}
              <code className="font-mono">{compareBot.id}</code> ·{" "}
              <span className="text-[var(--color-up)]">+{summary.added}</span>{" "}
              <span className="text-[var(--color-down)]">−{summary.removed}</span>
              {summary.identical && (
                <span className="ml-2 text-[var(--color-muted)]">— identical</span>
              )}
            </p>
          </div>
          <Link
            href={`/strategy?bot=${encodeURIComponent(botId)}`}
            className="text-[11px] text-[var(--color-accent)] hover:underline"
          >
            ← Single view
          </Link>
        </header>
        <StrategyCompareView
          baseBotId={botId}
          comparisonBots={bots
            .filter((b) => b.id !== botId)
            .map((b) => ({ id: b.id, name: b.name }))}
          activeCompareId={compareBot.id}
          lines={lines}
          summary={summary}
        />
      </div>
    );
  }

  const md = await readMemory("TRADING-STRATEGY.md", { bot: botId, strategy });
  const html = await marked.parse(md, { gfm: true });

  const otherBots = bots.filter((b) => b.id !== botId);

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Strategy</h1>
          <p className="text-xs text-[var(--color-muted)] mt-0.5">
            Read-only rule book · memory/{botId}/{strategy}/TRADING-STRATEGY.md
          </p>
        </div>
        {otherBots.length > 0 && (
          <StrategyCompareView
            baseBotId={botId}
            comparisonBots={otherBots.map((b) => ({ id: b.id, name: b.name }))}
            activeCompareId={null}
            lines={null}
            summary={null}
          />
        )}
      </header>
      <section className="frost rounded-2xl p-6 sm:p-8 mx-auto w-full max-w-3xl">
        <article
          className="prose-strategy text-sm"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </section>
    </div>
  );
}
