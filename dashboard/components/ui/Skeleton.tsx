import clsx from "clsx";

export function SkeletonBox({
  className,
  height = 80,
}: {
  className?: string;
  height?: number | string;
}) {
  return (
    <div
      className={clsx("frost rounded-2xl animate-pulse", className)}
      style={{ height }}
    />
  );
}

export function KpiRowSkeleton({ count = 5 }: { count?: number }) {
  return (
    <section className="grid grid-cols-2 lg:grid-cols-5 gap-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="frost rounded-xl h-20 animate-pulse" />
      ))}
    </section>
  );
}

export function PageHeaderSkeleton({ title }: { title: string }) {
  return (
    <header>
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      <p className="text-xs text-[var(--color-muted)] mt-0.5">Loading…</p>
    </header>
  );
}
