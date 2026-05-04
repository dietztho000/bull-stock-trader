"use client";

import { Card } from "@/components/ui/Card";
import type { RedactedSettings } from "@/lib/settings.schema";
import { FieldRow, NumberInput, Select, SectionFooter, Toggle } from "./_fields";
import { ResetLink } from "./DiscordSection";
import { useSettingsSection } from "./useSettingsSection";

const POLL_PRESETS = [
  { value: "1000", label: "1 second (very fast)" },
  { value: "5000", label: "5 seconds (default)" },
  { value: "15000", label: "15 seconds" },
  { value: "30000", label: "30 seconds" },
  { value: "60000", label: "1 minute" },
] as const;

type Draft = RedactedSettings["live"];

export function LiveDataSection({
  initial,
  onSaved,
  onResetSection,
}: {
  initial: Draft;
  onSaved: (next: RedactedSettings) => void;
  onResetSection: () => void;
}) {
  const { draft, setDraft, pending, error, dirty, save } = useSettingsSection<Draft>(
    "live",
    initial,
    onSaved
  );

  const pollValue = String(draft.pollIntervalMs);
  const pollMatchesPreset = POLL_PRESETS.some((p) => p.value === pollValue);

  return (
    <Card
      title="Live data & refresh"
      subtitle="How often the dashboard polls Alpaca and revalidates on focus."
      right={<ResetLink onClick={onResetSection} />}
    >
      <div className="space-y-4">
        <FieldRow
          label="Auto-refresh"
          description="When off, live tiles only update on manual revalidation (e.g. tab focus or page reload)."
        >
          <Toggle
            checked={draft.autoRefreshEnabled}
            onChange={(v) => setDraft((d) => ({ ...d, autoRefreshEnabled: v }))}
            label={draft.autoRefreshEnabled ? "On" : "Off"}
          />
        </FieldRow>

        <FieldRow
          label="Poll interval"
          description="Trade-off: faster intervals = more network traffic + Alpaca rate limit pressure."
        >
          <div className="flex flex-wrap items-center gap-2">
            <Select
              value={pollMatchesPreset ? pollValue : "custom"}
              onChange={(v) => {
                if (v === "custom") return;
                setDraft((d) => ({ ...d, pollIntervalMs: Number(v) }));
              }}
              options={[
                ...POLL_PRESETS,
                ...(pollMatchesPreset ? [] : [{ value: "custom" as const, label: "Custom" }]),
              ]}
            />
            <NumberInput
              min={1000}
              max={600000}
              step={500}
              value={draft.pollIntervalMs}
              onChange={(e) => {
                const n = Math.max(1000, Math.min(600_000, Number(e.target.value) || 1000));
                setDraft((d) => ({ ...d, pollIntervalMs: n }));
              }}
            />
            <span className="text-[11px] text-[var(--color-muted)]">ms</span>
          </div>
        </FieldRow>

        <FieldRow
          label="Refresh on focus"
          description="Re-fetch data when the dashboard tab regains focus."
        >
          <Toggle
            checked={draft.refreshOnFocus}
            onChange={(v) => setDraft((d) => ({ ...d, refreshOnFocus: v }))}
            label={draft.refreshOnFocus ? "On" : "Off"}
          />
        </FieldRow>

        <FieldRow
          label="Max positions shown"
          description="Cap rows in the live positions table. 0 = unlimited."
        >
          <NumberInput
            min={0}
            max={500}
            step={1}
            value={draft.maxPositionsShown}
            onChange={(e) =>
              setDraft((d) => ({
                ...d,
                maxPositionsShown: Math.max(
                  0,
                  Math.min(500, Number(e.target.value) || 0)
                ),
              }))
            }
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
