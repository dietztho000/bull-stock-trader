import { Card, Badge } from "@/components/ui/Card";
import { loadWeeklyReviews } from "@/lib/parsers/weeklyReview";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function WeeklyPage() {
  const reviews = await loadWeeklyReviews();

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-semibold">Weekly reviews</h1>
      {reviews.length === 0 ? (
        <Card title="No reviews yet">
          <div className="text-sm text-[var(--color-muted)]">
            Weekly reviews land Friday afternoon after the /weekly-review routine.
          </div>
        </Card>
      ) : (
        <div className="space-y-4">
          {reviews.map((r) => (
            <Card
              key={r.weekEnding}
              title={`Week ending ${r.weekEnding}`}
              right={r.grade ? <Badge tone={/A/i.test(r.grade) ? "up" : "neutral"}>Grade {r.grade}</Badge> : null}
            >
              {Object.keys(r.stats).length > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-1 text-sm mb-3">
                  {Object.entries(r.stats).map(([k, v]) => (
                    <div key={k} className="flex justify-between border-b border-[var(--color-border)]/40 py-1">
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
                <pre className="whitespace-pre-wrap mt-2 leading-relaxed">{r.body}</pre>
              </details>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
