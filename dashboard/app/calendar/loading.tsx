import { Card } from "@/components/ui/Card";
import { SkeletonBox } from "@/components/ui/Skeleton";

export default function CalendarLoading() {
  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Calendar</h1>
        <p className="text-xs text-[var(--color-muted)] mt-0.5">
          Loading earnings + economic events…
        </p>
      </header>
      <div className="grid lg:grid-cols-[minmax(0,1fr)_320px] gap-5">
        <Card title="Loading month grid…">
          <SkeletonBox height={420} />
        </Card>
        <Card title="Upcoming">
          <SkeletonBox height={300} />
        </Card>
      </div>
    </div>
  );
}
