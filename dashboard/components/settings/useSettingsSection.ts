"use client";

import { useEffect, useState } from "react";
import type { RedactedSettings, SectionKey } from "@/lib/settings.schema";

/** Shared save/dirty/error state for any settings section. Replaces the
 *  copy-pasted `save`/`useState`/`dirty` block that appeared in each
 *  *Section.tsx file. */
export function useSettingsSection<T extends object>(
  section: SectionKey,
  initial: T,
  onSaved: (next: RedactedSettings) => void
) {
  const [draft, setDraft] = useState<T>(initial);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDraft(initial);
  }, [initial]);

  const dirty = JSON.stringify(draft) !== JSON.stringify(initial);

  async function save(payloadOverride?: Partial<Record<SectionKey, T>>) {
    setPending(true);
    setError(null);
    try {
      const payload = payloadOverride ?? ({ [section]: draft } as Record<SectionKey, T>);
      const resp = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await resp.json();
      if (!resp.ok) {
        setError(data?.error ?? `HTTP ${resp.status}`);
        return null;
      }
      onSaved(data);
      return data as RedactedSettings;
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      return null;
    } finally {
      setPending(false);
    }
  }

  return { draft, setDraft, pending, error, dirty, save, setError };
}
