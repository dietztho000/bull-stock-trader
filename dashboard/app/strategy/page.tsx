import { Card } from "@/components/ui/Card";
import { readMemory } from "@/lib/memoryPath";
import { marked } from "marked";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function StrategyPage() {
  const md = await readMemory("TRADING-STRATEGY.md");
  const html = await marked.parse(md, { gfm: true });

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-semibold">Trading strategy</h1>
      <Card title="memory/TRADING-STRATEGY.md" subtitle="Read-only rule book">
        <article
          className="prose-strategy text-sm leading-relaxed"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </Card>
    </div>
  );
}
