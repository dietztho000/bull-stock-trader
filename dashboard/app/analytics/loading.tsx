import { SkeletonBox, KpiRowSkeleton, PageHeaderSkeleton } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <div className="space-y-5">
      <PageHeaderSkeleton title="Analytics" />
      <KpiRowSkeleton count={4} />
      <SkeletonBox height={340} />
      <SkeletonBox height={220} />
      <SkeletonBox height={220} />
    </div>
  );
}
