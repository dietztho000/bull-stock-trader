import { SkeletonBox, PageHeaderSkeleton } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <div className="space-y-5">
      <PageHeaderSkeleton title="Journal" />
      <SkeletonBox height={180} />
      <SkeletonBox height={180} />
      <SkeletonBox height={180} />
    </div>
  );
}
