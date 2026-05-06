import { marked } from "marked";
import { Card } from "@/components/ui/Card";
import { getDrawdownNarrative } from "@/lib/ai/drawdown";
import { fmtClockCT } from "@/lib/time";

/** `botId` is the bot key for memory paths; the legacy `account: AlpacaMode`
 *  arg is gone now that callers route via `OverviewCtx.botId` (audit NA1). */
export async function DrawdownNarrator({
  botId,
  strategy,
}: {
  botId: string;
  strategy?: string;
}) {
  if (!process.env.ANTHROPIC_API_KEY) return null;

  const result = await getDrawdownNarrative({ bot: botId, strategy });
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
