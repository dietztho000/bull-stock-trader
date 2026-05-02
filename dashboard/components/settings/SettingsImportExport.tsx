"use client";

import { useRef, useState } from "react";
import { Card } from "@/components/ui/Card";
import type { RedactedSettings } from "@/lib/settings.schema";

export function SettingsImportExport({
  onChange,
}: {
  onChange: (next: RedactedSettings) => void;
}) {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [pending, setPending] = useState<"import" | "reset" | null>(null);
  const [status, setStatus] = useState<{ tone: "ok" | "err"; msg: string } | null>(null);
  const [confirmingReset, setConfirmingReset] = useState(false);

  async function handleImportFile(file: File) {
    setPending("import");
    setStatus(null);
    try {
      const text = await file.text();
      const json = JSON.parse(text);
      const resp = await fetch("/api/settings/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(json),
      });
      const data = await resp.json();
      if (!resp.ok) {
        setStatus({ tone: "err", msg: data?.error ?? `HTTP ${resp.status}` });
        return;
      }
      onChange(data);
      setStatus({ tone: "ok", msg: "Settings imported. Secrets that were redacted in the file were preserved." });
    } catch (err) {
      setStatus({
        tone: "err",
        msg: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setPending(null);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function handleResetAll() {
    setPending("reset");
    setStatus(null);
    try {
      const resp = await fetch("/api/settings/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ section: "all" }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        setStatus({ tone: "err", msg: data?.error ?? `HTTP ${resp.status}` });
        return;
      }
      onChange(data);
      setConfirmingReset(false);
      setStatus({ tone: "ok", msg: "All sections reset to defaults." });
    } catch (err) {
      setStatus({
        tone: "err",
        msg: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setPending(null);
    }
  }

  return (
    <Card
      title="Backup & restore"
      subtitle="Export your dashboard settings, restore from a backup, or reset everything."
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <a
            href="/api/settings/export"
            className="glass glass-interactive rounded-full px-4 py-1.5 text-xs font-medium no-underline"
            download
          >
            Export JSON
          </a>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={pending === "import"}
            className="glass glass-interactive rounded-full px-4 py-1.5 text-xs font-medium disabled:opacity-50"
          >
            {pending === "import" ? "Importing…" : "Import JSON"}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void handleImportFile(f);
            }}
          />
          {!confirmingReset && (
            <button
              type="button"
              onClick={() => setConfirmingReset(true)}
              className="glass glass-interactive glass-tint-down rounded-full px-4 py-1.5 text-xs font-medium text-[var(--color-down)] ml-auto"
            >
              Reset all to defaults
            </button>
          )}
          {confirmingReset && (
            <div className="flex items-center gap-2 ml-auto">
              <span className="text-[11px] text-[var(--color-warn)]">
                This clears every section. Sure?
              </span>
              <button
                type="button"
                onClick={handleResetAll}
                disabled={pending === "reset"}
                className="glass glass-interactive glass-tint-down rounded-full px-3 py-1 text-xs font-semibold text-[var(--color-down)] disabled:opacity-50"
              >
                {pending === "reset" ? "Resetting…" : "Yes, reset everything"}
              </button>
              <button
                type="button"
                onClick={() => setConfirmingReset(false)}
                className="glass glass-interactive rounded-full px-3 py-1 text-xs"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
        <div className="text-xs text-[var(--color-muted)] leading-relaxed">
          The exported file masks Discord webhook URLs and ntfy topic with{" "}
          <code className="font-mono text-[var(--color-text)]">••••(redacted)</code>. On
          import, masked fields are skipped so existing secrets are preserved — you can edit
          your settings outside the dashboard and re-import without leaking webhooks.
        </div>
        {status && (
          <div
            className={
              status.tone === "ok"
                ? "text-[11px] text-[var(--color-up)]"
                : "text-[11px] text-[var(--color-down)] break-all"
            }
          >
            {status.msg}
          </div>
        )}
      </div>
    </Card>
  );
}
