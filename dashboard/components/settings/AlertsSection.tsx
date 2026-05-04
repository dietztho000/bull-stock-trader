"use client";

import { Card } from "@/components/ui/Card";
import type { RedactedSettings, AlertRule } from "@/lib/settings.schema";
import { FieldRow, NumberInput, SectionFooter, Toggle } from "./_fields";
import { ResetLink } from "./DiscordSection";
import { useSettingsSection } from "./useSettingsSection";

type Draft = RedactedSettings["alerts"];

const RULE_TYPES: Array<{
  value: AlertRule["type"];
  label: string;
  description: string;
  comingSoon?: boolean;
}> = [
  {
    value: "earnings-gate-T-N",
    label: "Earnings T-N",
    description: "Triggers when a held position has earnings within N trading days.",
  },
  {
    value: "drawdown-breaker",
    label: "Drawdown breaker (coming soon)",
    description:
      "Coming soon — toast dispatcher not wired yet. Will trigger when day or week P&L breaches the breaker threshold.",
    comingSoon: true,
  },
  {
    value: "sector-cap-reached",
    label: "Sector cap reached",
    description: "Triggers when a GICS sector reaches the open-position cap.",
  },
  {
    value: "sector-blocked",
    label: "Sector blocked",
    description: "Triggers when a sector is flagged BLOCKED (rule #10).",
  },
  {
    value: "cooldown-expiring",
    label: "Cooldown expiring",
    description: "Triggers N days before a re-entry cooldown ends.",
  },
  {
    value: "rule-violation",
    label: "Rule violation (coming soon)",
    description:
      "Coming soon — toast dispatcher not wired yet. Order rejections already toast directly from the order path; this rule type does not fire.",
    comingSoon: true,
  },
];

function newRuleId() {
  return `rule_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

export function AlertsSection({
  initial,
  onSaved,
  onResetSection,
}: {
  initial: Draft;
  onSaved: (next: RedactedSettings) => void;
  onResetSection: () => void;
}) {
  const { draft, setDraft, pending, error, dirty, save } = useSettingsSection<Draft>(
    "alerts",
    initial,
    onSaved
  );

  function addRule() {
    setDraft((d) => ({
      ...d,
      rules: [
        ...d.rules,
        {
          id: newRuleId(),
          enabled: true,
          type: "earnings-gate-T-N",
          daysThreshold: 2,
          channels: { toast: true, discord: false, ntfy: false },
        },
      ],
    }));
  }
  function updateRule(idx: number, patch: Partial<AlertRule>) {
    setDraft((d) => ({
      ...d,
      rules: d.rules.map((r, i) => (i === idx ? { ...r, ...patch } : r)),
    }));
  }
  function removeRule(idx: number) {
    setDraft((d) => ({ ...d, rules: d.rules.filter((_, i) => i !== idx) }));
  }
  function updateChannel(idx: number, channel: keyof AlertRule["channels"], value: boolean) {
    setDraft((d) => ({
      ...d,
      rules: d.rules.map((r, i) =>
        i === idx ? { ...r, channels: { ...r.channels, [channel]: value } } : r
      ),
    }));
  }

  return (
    <Card
      title="Alerts"
      subtitle="Triggered by strategy state changes. Toast delivery is wired today; Discord + ntfy delivery is pending dispatcher work."
      right={<ResetLink onClick={onResetSection} />}
    >
      <div className="space-y-4">
        <FieldRow
          label="Alerts enabled"
          description="Master switch — when off, no rules fire regardless of state."
        >
          <Toggle
            checked={draft.enabled}
            onChange={(v) => setDraft((d) => ({ ...d, enabled: v }))}
            label={draft.enabled ? "On" : "Off"}
          />
        </FieldRow>

        <div className="space-y-2.5">
          {draft.rules.length === 0 && (
            <div className="text-xs text-[var(--color-muted)] py-3">
              No alert rules configured. Click <em>Add rule</em> to start.
            </div>
          )}
          {draft.rules.map((rule, i) => {
            const meta = RULE_TYPES.find((m) => m.value === rule.type);
            const usesDays =
              rule.type === "earnings-gate-T-N" || rule.type === "cooldown-expiring";
            return (
              <div
                key={rule.id}
                className="rounded-lg p-3 border border-[rgba(255,255,255,0.06)] space-y-2"
              >
                <div className="flex items-baseline gap-2 flex-wrap">
                  <Toggle
                    checked={rule.enabled}
                    onChange={(v) => updateRule(i, { enabled: v })}
                    label={rule.enabled ? "Enabled" : "Disabled"}
                  />
                  <select
                    value={rule.type}
                    onChange={(e) => updateRule(i, { type: e.target.value as AlertRule["type"] })}
                    className="px-2.5 py-1 rounded-lg glass text-xs cursor-pointer min-w-[12rem]"
                  >
                    {RULE_TYPES.map((m) => (
                      <option key={m.value} value={m.value}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                  {usesDays && (
                    <NumberInput
                      min={0}
                      max={30}
                      step={1}
                      value={rule.daysThreshold}
                      onChange={(e) =>
                        updateRule(i, {
                          daysThreshold: Math.max(0, Math.min(30, Number(e.target.value) || 0)),
                        })
                      }
                      className="w-20"
                    />
                  )}
                  <button
                    type="button"
                    onClick={() => removeRule(i)}
                    className="ml-auto text-[11px] text-[var(--color-muted)] hover:text-[var(--color-down)] underline underline-offset-2"
                  >
                    Remove
                  </button>
                </div>
                {meta && (
                  <p className="text-[11px] text-[var(--color-muted)] leading-relaxed">
                    {meta.description}
                  </p>
                )}
                <div className="flex items-center gap-3 flex-wrap">
                  <ChannelToggle
                    label="Toast"
                    checked={rule.channels.toast}
                    onChange={(v) => updateChannel(i, "toast", v)}
                  />
                  <ChannelToggle
                    label="Discord"
                    checked={rule.channels.discord}
                    onChange={(v) => updateChannel(i, "discord", v)}
                  />
                  <ChannelToggle
                    label="ntfy"
                    checked={rule.channels.ntfy}
                    onChange={(v) => updateChannel(i, "ntfy", v)}
                  />
                </div>
              </div>
            );
          })}
        </div>

        <button
          type="button"
          onClick={addRule}
          className="glass glass-interactive rounded-full px-3 py-1.5 text-xs font-semibold"
        >
          + Add rule
        </button>
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

function ChannelToggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="inline-flex items-center gap-1.5 text-[11px] cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="accent-[var(--color-accent)]"
      />
      <span>{label}</span>
    </label>
  );
}
