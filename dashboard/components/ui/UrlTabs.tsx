"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useTransition } from "react";
import { SegmentedGlass } from "./Glass";

export function UrlTabs<T extends string>({
  param = "tab",
  options,
  fallback,
  layoutId,
  ariaLabel,
}: {
  param?: string;
  options: { value: T; label: string }[];
  fallback: T;
  layoutId: string;
  /** Read by screen readers as the tablist's name (audit U10). Defaults to a
   *  human-friendly form of the layoutId so existing call sites keep working. */
  ariaLabel?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  const current = (searchParams.get(param) as T) ?? fallback;
  const valid = options.some((o) => o.value === current) ? current : fallback;

  function setTab(next: T) {
    const params = new URLSearchParams(searchParams.toString());
    if (next === fallback) params.delete(param);
    else params.set(param, next);
    const qs = params.toString();
    startTransition(() => {
      router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    });
  }

  const label =
    ariaLabel ?? layoutId.replace(/-/g, " ").replace(/\btabs\b/i, "tabs");

  return (
    <SegmentedGlass<T>
      layoutId={layoutId}
      value={valid}
      onChange={setTab}
      options={options}
      ariaLabel={label}
    />
  );
}
