import { Card } from "@/components/ui/Card";
import { getDrawdownNarrative } from "@/lib/ai/drawdown";

export async function DrawdownNarrator() {
  if (!process.env.ANTHROPIC_API_KEY) return null;

  const result = await getDrawdownNarrative();
  if (!result.triggered) return null;

  return (
    <Card title="Drawdown context (AI)">
      {"error" in result ? (
        <div className="text-xs text-[var(--color-down)]">{result.error}</div>
      ) : (
        <>
          <div className="text-sm text-[var(--color-text)] leading-relaxed whitespace-pre-wrap">
            {result.narrative}
          </div>
          <div className="mt-2 text-[10px] text-[var(--color-muted)]">
            generated {new Date(result.generatedAt).toLocaleTimeString()} · cached 10 min
          </div>
        </>
      )}
    </Card>
  );
}
