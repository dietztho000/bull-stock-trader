import { readMemory } from "@/lib/memoryPath";
import { marked } from "marked";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function StrategyPage() {
  const md = await readMemory("TRADING-STRATEGY.md");
  const html = await marked.parse(md, { gfm: true });

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Strategy</h1>
        <p className="text-xs text-[var(--color-muted)] mt-0.5">
          Read-only rule book · memory/TRADING-STRATEGY.md
        </p>
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
