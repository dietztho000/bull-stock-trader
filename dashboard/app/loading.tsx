import { SkeletonBox, KpiRowSkeleton } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <div className="space-y-6">
      <SkeletonBox height={220} />
      <SkeletonBox height={320} />
      <KpiRowSkeleton />
      <div className="grid lg:grid-cols-2 gap-5">
        <SkeletonBox height={240} />
        <SkeletonBox height={240} />
      </div>
    </div>
  );
}
