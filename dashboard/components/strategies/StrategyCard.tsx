"use client";

import clsx from "clsx";
import { Badge } from "@/components/ui/Card";
import type { StrategyDefinition, StrategyParam } from "@/lib/settings";

function formatParamValue(p: StrategyParam): string {
  switch (p.kind) {
    case "number":
      return p.unit ? `${p.value} ${p.unit}` : String(p.value);
    case "percent":
      return `${p.value}%`;
    case "enum":
      return p.value;
    case "table":
      return `${p.rows.length} rows`;
  }
}

export function StrategyCard({
  strategy,
  inUseBy,
}: {
  strategy: StrategyDefinition;
  /** Bot ids currently referencing this strategy. */
  inUseBy: string[];
}) {
  const ruleBookLines = strategy.ruleBookTemplate.trim().length
    ? strategy.ruleBookTemplate.split("\n").length
    : 0;

  return (
    <div
      className={clsx(
        "frost rounded-xl p-4 space-y-3",
        !strategy.enabled && "opacity-60"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-sm font-semibold truncate">{strategy.name}</h3>
            <code className="text-[10px] text-[var(--color-muted)] bg-[rgba(255,255,255,0.04)] rounded px-1.5 py-0.5">
              {strategy.slug}
            </code>
            {!strategy.enabled && <Badge tone="warn">disabled</Badge>}
            <Badge tone="neutral">v{strategy.version}</Badge>
          </div>
          {strategy.description && (
            <p className="text-xs text-[var(--color-muted)] mt-1 line-clamp-2">
              {strategy.description}
            </p>
          )}
        </div>
        <div className="text-[10px] text-[var(--color-muted)] shrink-0 text-right">
          {inUseBy.length === 0 ? (
            <span>no bots</span>
          ) : (
            <span>
              used by{" "}
              <span className="text-[var(--color-text)] font-medium">
                {inUseBy.length} bot{inUseBy.length === 1 ? "" : "s"}
              </span>
            </span>
          )}
          {inUseBy.length > 0 && (
            <div className="mt-0.5 max-w-[8rem] truncate">
              {inUseBy.join(", ")}
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 text-[10px] text-[var(--color-muted)]">
        <span>
          <span className="text-[var(--color-text)] font-medium tabular">
            {strategy.params.length}
          </span>{" "}
          param{strategy.params.length === 1 ? "" : "s"}
        </span>
        <span aria-hidden>·</span>
        <span>
          <span className="text-[var(--color-text)] font-medium tabular">
            {ruleBookLines}
          </span>{" "}
          rule-book line{ruleBookLines === 1 ? "" : "s"}
        </span>
      </div>

      {strategy.params.length > 0 && (
        <ul className="space-y-1">
          {strategy.params.slice(0, 6).map((p) => (
            <li
              key={p.key}
              className="flex items-baseline justify-between gap-2 text-[11px]"
            >
              <span className="text-[var(--color-muted)] truncate">{p.label}</span>
              <span className="font-medium tabular shrink-0">
                {formatParamValue(p)}
              </span>
            </li>
          ))}
          {strategy.params.length > 6 && (
            <li className="text-[10px] text-[var(--color-muted)]">
              +{strategy.params.length - 6} more
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
