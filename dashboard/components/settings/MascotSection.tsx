"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import type { RedactedSettings } from "@/lib/settings.schema";
import { FieldRow, TextInput, Toggle, SectionFooter } from "./_fields";
import { ResetLink } from "./DiscordSection";

type MascotDraft = RedactedSettings["mascot"];

export function MascotSection({
  initial,
  onSaved,
  onResetSection,
}: {
  initial: MascotDraft;
  onSaved: (next: RedactedSettings) => void;
  onResetSection: () => void;
}) {
  const [draft, setDraft] = useState<MascotDraft>(initial);
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
        body: JSON.stringify({ mascot: draft }),
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
      title="Trader Max (mascot)"
      subtitle="A live, expressive bull-trader character that reacts to your P&L."
      right={<ResetLink onClick={onResetSection} />}
    >
      <div className="space-y-4">
        <FieldRow
          label="Mascot name"
          description="Shown in the tile, badge, and recap modal."
        >
          <TextInput
            value={draft.name}
            maxLength={40}
            onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
            placeholder="Trader Max"
          />
        </FieldRow>

        <FieldRow
          label="Confetti on big green days"
          description="Bursts once per CT day when day P&L crosses +1.5%. Runs locally; nothing is sent anywhere."
        >
          <Toggle
            checked={draft.confettiOnWin}
            onChange={(next) => setDraft((d) => ({ ...d, confettiOnWin: next }))}
            label={draft.confettiOnWin ? "On" : "Off"}
          />
        </FieldRow>

        <FieldRow
          label="Mascot in sidebar"
          description="Trader Max lives at the bottom of the side nav with current mood and level progress. Click opens the recap modal. Disable to hide the sidebar card (the dashboard tile is unaffected — toggle that via the layout's tile visibility menu)."
        >
          <Toggle
            checked={draft.showInNav}
            onChange={(next) => setDraft((d) => ({ ...d, showInNav: next }))}
            label={draft.showInNav ? "Visible" : "Hidden"}
          />
        </FieldRow>

        <FieldRow
          label="Seasonal outfits"
          description="Trader Max wears a pumpkin near Halloween, Santa hat at Christmas, etc. Pure cosmetic."
        >
          <Toggle
            checked={draft.seasonalOutfits}
            onChange={(next) => setDraft((d) => ({ ...d, seasonalOutfits: next }))}
            label={draft.seasonalOutfits ? "On" : "Off"}
          />
        </FieldRow>

        <FieldRow
          label="Idle micro-animations"
          description="Occasional blinks and subtle gestures while the mascot is idle. Tap-to-pet still works regardless."
        >
          <Toggle
            checked={draft.idleAnimations}
            onChange={(next) => setDraft((d) => ({ ...d, idleAnimations: next }))}
            label={draft.idleAnimations ? "On" : "Off"}
          />
        </FieldRow>

        <FieldRow
          label="Sound cues"
          description="Soft procedural tones on achievement unlocks, motivate clicks, and bearish-mood entry. Honors quiet hours from the notifications section. Off by default."
        >
          <Toggle
            checked={draft.soundsEnabled}
            onChange={(next) => setDraft((d) => ({ ...d, soundsEnabled: next }))}
            label={draft.soundsEnabled ? "On" : "Off"}
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
