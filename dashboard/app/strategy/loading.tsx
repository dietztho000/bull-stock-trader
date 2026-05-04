import { Card } from "@/components/ui/Card";
import { SkeletonBox } from "@/components/ui/Skeleton";

export default function StrategyLoading() {
  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Strategy</h1>
        <p className="text-xs text-[var(--color-muted)] mt-0.5">
          Loading rulebook…
        </p>
      </header>
      <Card title="memory/TRADING-STRATEGY.md">
        <SkeletonBox height={500} />
      </Card>
    </div>
  );
}
