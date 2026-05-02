import { SkeletonBox, KpiRowSkeleton, PageHeaderSkeleton } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <div className="space-y-5">
      <PageHeaderSkeleton title="Trades" />
      <KpiRowSkeleton count={5} />
      <SkeletonBox height={420} />
      <SkeletonBox height={120} />
    </div>
  );
}
