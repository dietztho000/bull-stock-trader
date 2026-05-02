import { UrlTabs } from "@/components/ui/UrlTabs";
import type { AlpacaMode } from "@/lib/alpacaMode";

export function AccountTabsControl({ activeTab }: { activeTab: AlpacaMode }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-[10px] uppercase tracking-[0.16em] text-[var(--color-muted)] font-semibold">
        Account
      </span>
      <UrlTabs<AlpacaMode>
        param="account"
        layoutId="account-tabs"
        options={[
          { value: "live", label: "Live" },
          { value: "paper", label: "Paper" },
        ]}
        fallback={activeTab}
      />
    </div>
  );
}
