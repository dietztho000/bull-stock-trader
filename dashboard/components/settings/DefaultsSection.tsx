"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import type { RedactedSettings } from "@/lib/settings.schema";
import { FieldRow, Select, SectionFooter } from "./_fields";
import { ResetLink } from "./DiscordSection";

const ACCOUNT_MODES = [
  { value: "live", label: "Live (real money)" },
  { value: "paper", label: "Paper (simulated)" },
] as const;

const CHART_RANGES = [
  { value: "30d", label: "Last 30 days" },
  { value: "90d", label: "Last 90 days" },
  { value: "ytd", label: "Year-to-date (default)" },
  { value: "1y", label: "Last 1 year" },
  { value: "all", label: "All time" },
] as const;

const TRADES_FILTERS = [
  { value: "all", label: "All trades" },
  { value: "open", label: "Open positions only" },
  { value: "closed-30d", label: "Closed (last 30 days)" },
  { value: "closed-90d", label: "Closed (last 90 days)" },
] as const;

type Draft = RedactedSettings["defaults"];

export function DefaultsSection({
  initial,
  onSaved,
  onResetSection,
}: {
  initial: Draft;
  onSaved: (next: RedactedSettings) => void;
  onResetSection: () => void;
}) {
  const [draft, setDraft] = useState<Draft>(initial);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDraft(initial);
  }, [initial]);

  const dirty = JSON.stringify(draft) !== JSON.stringify(initial);

  async function save() {
    setPending(true);
    setError(null);
    try {
      const resp = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ defaults: draft }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        setError(data?.error ?? `HTTP ${resp.status}`);
        return;
      }
      onSaved(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setPending(false);
    }
  }

  return (
    <Card
      title="Account & defaults"
      subtitle="Pre-selected values when you arrive at a page or open the dashboard."
      right={<ResetLink onClick={onResetSection} />}
    >
      <div className="space-y-4">
        <FieldRow
          label="Default account mode"
          description="Which Alpaca account is active when no URL parameter or saved preference exists. Switching the account chip in the header still wins for the current session."
        >
          <Select
            value={draft.defaultAccountMode}
            onChange={(v) => setDraft((d) => ({ ...d, defaultAccountMode: v }))}
            options={ACCOUNT_MODES}
          />
        </FieldRow>

        <FieldRow
          label="Default chart range"
          description="Initial date range on charts that support range selection."
        >
          <Select
            value={draft.chartDateRangeDefault}
            onChange={(v) => setDraft((d) => ({ ...d, chartDateRangeDefault: v }))}
            options={CHART_RANGES}
          />
        </FieldRow>

        <FieldRow
          label="Default trades filter"
          description="Pre-selected filter on the Trades page."
        >
          <Select
            value={draft.tradesPageDefaultFilter}
            onChange={(v) => setDraft((d) => ({ ...d, tradesPageDefaultFilter: v }))}
            options={TRADES_FILTERS}
          />
        </FieldRow>
      </div>

      <SectionFooter
        dirty={dirty}
        pending={pending}
        error={error}
        onSave={save}
        onReset={onResetSection}
      />
    </Card>
  );
}
