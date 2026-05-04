"use client";

import { Card } from "@/components/ui/Card";
import type { RedactedSettings } from "@/lib/settings.schema";
import { FieldRow, NumberInput, SectionFooter } from "./_fields";
import { ResetLink } from "./DiscordSection";
import { useSettingsSection } from "./useSettingsSection";

type Draft = RedactedSettings["strategy"];

export function StrategySection({
  initial,
  onSaved,
  onResetSection,
}: {
  initial: Draft;
  onSaved: (next: RedactedSettings) => void;
  onResetSection: () => void;
}) {
  const { draft, setDraft, pending, error, dirty, save } = useSettingsSection<Draft>(
    "strategy",
    initial,
    onSaved
  );

  function patch<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
  }

  return (
    <Card
      title="Strategy thresholds"
      subtitle="Mirrors memory/TRADING-STRATEGY.md. Bot routines read .env directly — these only affect dashboard enforcement views and the mascot."
      right={<ResetLink onClick={onResetSection} />}
    >
      <div className="space-y-4">
        <FieldRow
          label="Sector cap"
          description="Rule #17. Max open positions per GICS sector before new entries are blocked."
        >
          <NumberInput
            min={1}
            max={10}
            step={1}
            value={draft.sectorCap}
            onChange={(e) => patch("sectorCap", Math.max(1, Math.min(10, Number(e.target.value) || 1)))}
          />
        </FieldRow>

        <FieldRow
          label="Max open positions"
          description="Hard ceiling on simultaneously open trades."
        >
          <NumberInput
            min={1}
            max={20}
            step={1}
            value={draft.maxOpenPositions}
            onChange={(e) => patch("maxOpenPositions", Math.max(1, Math.min(20, Number(e.target.value) || 1)))}
          />
        </FieldRow>

        <FieldRow
          label="Day breaker (%)"
          description="Rule #14. New entries blocked while day P&L is below this threshold (negative number)."
        >
          <NumberInput
            min={-20}
            max={0}
            step={0.1}
            value={draft.dayBreakerPct}
            onChange={(e) => patch("dayBreakerPct", Math.max(-20, Math.min(0, Number(e.target.value) || 0)))}
          />
        </FieldRow>

        <FieldRow
          label="Week breaker (%)"
          description="Rule #14. New entries blocked while week P&L is below this threshold."
        >
          <NumberInput
            min={-30}
            max={0}
            step={0.1}
            value={draft.weekBreakerPct}
            onChange={(e) => patch("weekBreakerPct", Math.max(-30, Math.min(0, Number(e.target.value) || 0)))}
          />
        </FieldRow>

        <FieldRow
          label="Mascot celebrating threshold (%)"
          description="Day P&L above this triggers the celebrating mood + confetti."
        >
          <NumberInput
            min={0}
            max={20}
            step={0.1}
            value={draft.celebrateThresholdPct}
            onChange={(e) => patch("celebrateThresholdPct", Math.max(0, Math.min(20, Number(e.target.value) || 0)))}
          />
        </FieldRow>

        <FieldRow
          label="Mascot bullish threshold (%)"
          description="Day P&L above this turns the mascot bullish (but not celebrating)."
        >
          <NumberInput
            min={0}
            max={20}
            step={0.1}
            value={draft.bullishThresholdPct}
            onChange={(e) => patch("bullishThresholdPct", Math.max(0, Math.min(20, Number(e.target.value) || 0)))}
          />
        </FieldRow>

        <FieldRow
          label="Mascot bearish threshold (%)"
          description="Day P&L below this turns the mascot bearish."
        >
          <NumberInput
            min={-20}
            max={0}
            step={0.1}
            value={draft.bearishThresholdPct}
            onChange={(e) => patch("bearishThresholdPct", Math.max(-20, Math.min(0, Number(e.target.value) || 0)))}
          />
        </FieldRow>

        <FieldRow
          label="Target deployed (low %)"
          description="Bottom of the desirable capital deployment band (75%–85% by default)."
        >
          <NumberInput
            min={0}
            max={100}
            step={1}
            value={draft.targetDeployedLowPct}
            onChange={(e) => patch("targetDeployedLowPct", Math.max(0, Math.min(100, Number(e.target.value) || 0)))}
          />
        </FieldRow>

        <FieldRow
          label="Target deployed (high %)"
          description="Top of the desirable capital deployment band."
        >
          <NumberInput
            min={0}
            max={100}
            step={1}
            value={draft.targetDeployedHighPct}
            onChange={(e) => patch("targetDeployedHighPct", Math.max(0, Math.min(100, Number(e.target.value) || 0)))}
          />
        </FieldRow>

        <FieldRow
          label="Earnings gate (days)"
          description="Rule #13. No new entry within this many trading days of an earnings print."
        >
          <NumberInput
            min={0}
            max={10}
            step={1}
            value={draft.earningsGateDays}
            onChange={(e) => patch("earningsGateDays", Math.max(0, Math.min(10, Number(e.target.value) || 0)))}
          />
        </FieldRow>

        <FieldRow
          label="Entry score minimum"
          description="Rule #19 floor. Trades scoring below this should be flagged (1–10)."
        >
          <NumberInput
            min={0}
            max={10}
            step={1}
            value={draft.entryScoreMin}
            onChange={(e) => patch("entryScoreMin", Math.max(0, Math.min(10, Number(e.target.value) || 0)))}
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
