import { Card, Badge } from "@/components/ui/Card";
import { loadResearchLog } from "@/lib/parsers/researchLog";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function ResearchPage() {
  const entries = await loadResearchLog();

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-semibold">Research log</h1>
      {entries.length === 0 ? (
        <Card title="No entries yet">
          <div className="text-sm text-[var(--color-muted)]">
            Pre-market research will appear here once the bot starts running its
            6 AM routine.
          </div>
        </Card>
      ) : (
        <div className="space-y-4">
          {entries.map((e) => (
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
                  <div className="text-[11px] uppercase tracking-wider text-[var(--color-muted)] mb-1">
                    Ideas
                  </div>
                  <ul className="text-sm list-disc pl-5 space-y-0.5">
                    {e.ideas.map((i, idx) => (
                      <li key={idx}>{i}</li>
                    ))}
                  </ul>
                </div>
              )}
              <details className="text-xs">
                <summary className="cursor-pointer text-[var(--color-muted)] hover:text-[var(--color-accent)]">
                  Full entry
                </summary>
                <pre className="whitespace-pre-wrap mt-2 leading-relaxed">{e.body}</pre>
              </details>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
