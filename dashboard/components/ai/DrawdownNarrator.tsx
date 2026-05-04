import { marked } from "marked";
import { Card } from "@/components/ui/Card";
import { getDrawdownNarrative } from "@/lib/ai/drawdown";
import { fmtClockCT } from "@/lib/time";
import type { AlpacaMode } from "@/lib/alpacaMode";

export async function DrawdownNarrator({
  account,
  botId,
  strategy,
}: {
  account: AlpacaMode;
  botId?: string;
  strategy?: string;
}) {
  if (!process.env.ANTHROPIC_API_KEY) return null;

  // Prefer the registered bot id so non-`live`/`paper` bots also get
  // narrative (the legacy `account: AlpacaMode` arg only worked for the two
  // built-in bots — see audit 7.12).
  const result = await getDrawdownNarrative({
    bot: botId ?? account,
    strategy,
  });
  if (!result.triggered) return null;

  return (
    <Card title="Drawdown context (AI)">
      {"error" in result ? (
        <div className="text-xs text-[var(--color-down)]">{result.error}</div>
      ) : (
        <>
          <article
            className="prose-ai"
            dangerouslySetInnerHTML={{
              __html: marked.parse(result.narrative, { async: false, gfm: true }) as string,
            }}
          />
          <div className="mt-2 text-[10px] text-[var(--color-muted)]">
            generated {fmtClockCT(result.generatedAt)} · cached 10 min
          </div>
        </>
      )}
    </Card>
  );
}
