"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import type { RedactedSettings } from "@/lib/settings.schema";
import { FieldRow, NumberInput, Select, SectionFooter } from "./_fields";
import { ResetLink } from "./DiscordSection";
import {
  hasSessionLiveConfirmation,
  revokeSessionLiveConfirmation,
} from "@/lib/tradingAccountContext";

const THEMES = [
  { value: "dark", label: "Dark" },
  { value: "light", label: "Light" },
  { value: "auto", label: "Auto (match OS)" },
] as const;

const LANDING = [
  { value: "overview", label: "Overview (default)" },
  { value: "trades", label: "Trades" },
  { value: "calendar", label: "Calendar" },
  { value: "journal", label: "Journal" },
  { value: "analytics", label: "Analytics" },
  { value: "strategy", label: "Strategy" },
] as const;

const NUMBER_FORMATS = [
  { value: "full", label: "Full ($1,234.56)" },
  { value: "compact", label: "Compact ($1.2K)" },
] as const;

const CURRENCIES = [
  { value: "USD", label: "USD ($)" },
  { value: "raw", label: "Raw (no symbol)" },
] as const;

type DisplayDraft = RedactedSettings["display"];

export function DisplaySection({
  initial,
  onSaved,
  onResetSection,
}: {
  initial: DisplayDraft;
  onSaved: (next: RedactedSettings) => void;
  onResetSection: () => void;
}) {
  const [draft, setDraft] = useState<DisplayDraft>(initial);
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
        body: JSON.stringify({ display: draft }),
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
      title="Display & theme"
      subtitle="Personalize the dashboard look and which page you land on first."
      right={<ResetLink onClick={onResetSection} />}
    >
      <div className="space-y-4">
        <FieldRow label="Theme" description="Match the OS or pick a fixed appearance.">
          <Select
            value={draft.theme}
            onChange={(v) => setDraft((d) => ({ ...d, theme: v }))}
            options={THEMES}
          />
        </FieldRow>

        <FieldRow
          label="Default landing page"
          description="Where the dashboard sends you on first visit each session. Re-clicking Overview during a session is never intercepted."
        >
          <Select
            value={draft.defaultLandingPage}
            onChange={(v) => setDraft((d) => ({ ...d, defaultLandingPage: v }))}
            options={LANDING}
          />
        </FieldRow>

        <FieldRow
          label="Number format"
          description="How dollars and large numbers are rendered in tiles and tables."
        >
          <Select
            value={draft.numberFormat}
            onChange={(v) => setDraft((d) => ({ ...d, numberFormat: v }))}
            options={NUMBER_FORMATS}
          />
        </FieldRow>

        <FieldRow label="Currency display">
          <Select
            value={draft.currency}
            onChange={(v) => setDraft((d) => ({ ...d, currency: v }))}
            options={CURRENCIES}
          />
        </FieldRow>

        <FieldRow
          label="Hide tiny positions below"
          description="Positions with absolute market value under this threshold are hidden from the live positions table. 0 disables."
        >
          <div className="flex items-center gap-2">
            <span className="text-xs text-[var(--color-muted)]">$</span>
            <NumberInput
              min={0}
              step={50}
              value={draft.hideTinyPositionsBelow}
              onChange={(e) =>
                setDraft((d) => ({
                  ...d,
                  hideTinyPositionsBelow: Math.max(0, Number(e.target.value) || 0),
                }))
              }
            />
          </div>
        </FieldRow>

        <LiveConfirmRevokeRow />
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

function LiveConfirmRevokeRow() {
  const [confirmed, setConfirmed] = useState(false);
  const [justRevoked, setJustRevoked] = useState(false);

  useEffect(() => {
    setConfirmed(hasSessionLiveConfirmation());
  }, []);

  function revoke() {
    revokeSessionLiveConfirmation();
    setConfirmed(false);
    setJustRevoked(true);
    setTimeout(() => setJustRevoked(false), 1800);
  }

  return (
    <FieldRow
      label="Live trading confirmation"
      description="Switching to a live account in this session prompts a one-time I-CONFIRM-LIVE dialog. Revoke to require confirmation again on the next switch."
    >
      <div className="flex items-center gap-2 text-xs">
        <span className="text-[var(--color-muted)]">
          {confirmed ? "Confirmed for this session" : "Not confirmed"}
        </span>
        <button
          type="button"
          onClick={revoke}
          disabled={!confirmed}
          className="glass rounded-full px-3 py-1 text-[11px] font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {justRevoked ? "✓ Revoked" : "Revoke"}
        </button>
      </div>
    </FieldRow>
  );
}
