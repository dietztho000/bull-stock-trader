"use client";

import { useState, type ReactNode } from "react";
import clsx from "clsx";
import type { AlpacaMode } from "@/lib/alpacaMode";

export function AccountTabs({
  livePanel,
  paperPanel,
  defaultTab,
}: {
  livePanel: ReactNode;
  paperPanel: ReactNode;
  defaultTab: AlpacaMode;
}) {
  const [active, setActive] = useState<AlpacaMode>(defaultTab);

  const tabClass = (target: AlpacaMode) =>
    clsx(
      "px-3 py-1.5 text-sm rounded-t border-b-2 -mb-px transition-colors",
      active === target
        ? "border-[var(--color-accent)] text-[var(--color-accent)] font-semibold"
        : "border-transparent text-[var(--color-muted)] hover:text-[var(--color-text)]"
    );

  return (
    <div>
      <div
        role="tablist"
        aria-label="Account view"
        className="flex gap-1 border-b border-[var(--color-border)] mb-4"
      >
        <button
          type="button"
          role="tab"
          aria-selected={active === "live"}
          className={tabClass("live")}
          onClick={() => setActive("live")}
        >
          Live
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={active === "paper"}
          className={tabClass("paper")}
          onClick={() => setActive("paper")}
        >
          Paper
        </button>
      </div>

      <div role="tabpanel" hidden={active !== "live"}>
        {livePanel}
      </div>
      <div role="tabpanel" hidden={active !== "paper"}>
        {paperPanel}
      </div>
    </div>
  );
}
