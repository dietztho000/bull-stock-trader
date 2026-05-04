"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import type { RedactedSettings, WebhookCategory } from "@/lib/settings.schema";
import { FieldRow, SectionFooter, Toggle } from "./_fields";
import { ResetLink } from "./DiscordSection";
import {
  getNotifyPermission,
  notificationsSupported,
  requestNotifyPermission,
} from "@/lib/desktopNotify";

const CATEGORIES: { key: WebhookCategory; label: string; hint: string }[] = [
  { key: "research", label: "Research briefs", hint: "Pre-market briefs sent from /api/discord/brief." },
  { key: "fill", label: "Fills", hint: "Order fills + position changes." },
  { key: "midday", label: "Midday updates", hint: "Midday rotation + watchlist nudges." },
  { key: "stops", label: "Stop-outs", hint: "Fixed-stop / trail / earnings-T1 / gap exits. Can be noisy." },
  { key: "eod", label: "End-of-day recap", hint: "Daily summary at the close." },
  { key: "weekly", label: "Weekly review", hint: "Friday weekly review." },
  { key: "error", label: "Errors", hint: "Bot errors / canary failures. Recommended: keep on." },
  { key: "auth-canary", label: "Auth canary", hint: "Pre-open credential probe. Recommended: keep on." },
  { key: "alert", label: "Alert rules", hint: "Dashboard rule alerts. Off by default — ntfy is the recommended channel." },
];

type Draft = RedactedSettings["notifications"];

export function NotificationsSection({
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
  const [permission, setPermission] = useState<string>("default");
  // SSR sees `Notification === undefined` → notificationsSupported() → false,
  // but in the browser it's true. Defer the browser-dependent UI to after
  // mount so the first client paint matches the server HTML.
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setDraft(initial);
  }, [initial]);

  useEffect(() => {
    setMounted(true);
    setPermission(getNotifyPermission());
  }, []);

  const supported = mounted && notificationsSupported();

  const dirty = JSON.stringify(draft) !== JSON.stringify(initial);

  async function save() {
    setPending(true);
    setError(null);
    try {
      const resp = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notifications: draft }),
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

  async function toggleDesktop(next: boolean) {
    if (!next) {
      setDraft((d) => ({ ...d, desktopNotificationsEnabled: false }));
      return;
    }
    if (!notificationsSupported()) {
      setError("Browser does not support desktop notifications.");
      return;
    }
    const result = await requestNotifyPermission();
    setPermission(result);
    if (result === "granted") {
      setDraft((d) => ({ ...d, desktopNotificationsEnabled: true }));
    } else {
      setDraft((d) => ({ ...d, desktopNotificationsEnabled: false }));
      setError(
        result === "denied"
          ? "Permission denied — enable notifications for this site in your browser settings."
          : "Notification permission was not granted."
      );
    }
  }

  return (
    <Card
      title="Notifications"
      subtitle="Filter dashboard-originated alerts and define quiet hours."
      right={<ResetLink onClick={onResetSection} />}
    >
      <div className="space-y-5">
        <FieldRow
          label="Webhook category filters"
          description="Suppress dashboard-triggered Discord/ntfy sends by category. Bot routines that fire from cron are unaffected — they read .env directly."
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {CATEGORIES.map((c) => (
              <label
                key={c.key}
                className="flex items-start gap-2 p-2 rounded-lg glass cursor-pointer"
                title={c.hint}
              >
                <Toggle
                  checked={draft.webhookCategoryFilters[c.key]}
                  onChange={(v) =>
                    setDraft((d) => ({
                      ...d,
                      webhookCategoryFilters: {
                        ...d.webhookCategoryFilters,
                        [c.key]: v,
                      },
                    }))
                  }
                />
                <div className="min-w-0">
                  <div className="text-xs font-medium">{c.label}</div>
                  <div className="text-[11px] text-[var(--color-muted)] truncate">
                    {c.hint}
                  </div>
                </div>
              </label>
            ))}
          </div>
        </FieldRow>

        <FieldRow
          label="Quiet hours (CT)"
          description="During this window, dashboard-originated sends are suppressed. Test sends always fire."
        >
          <div className="flex flex-wrap items-center gap-3">
            <Toggle
              checked={draft.quietHours.enabled}
              onChange={(v) =>
                setDraft((d) => ({
                  ...d,
                  quietHours: { ...d.quietHours, enabled: v },
                }))
              }
              label={draft.quietHours.enabled ? "Enabled" : "Disabled"}
            />
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-[var(--color-muted)]">From</span>
              <input
                type="time"
                value={draft.quietHours.startCT}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    quietHours: { ...d.quietHours, startCT: e.target.value },
                  }))
                }
                disabled={!draft.quietHours.enabled}
                className="px-2 py-1 rounded-lg glass text-xs tabular focus:outline-none focus:border-[var(--color-accent)] disabled:opacity-50"
              />
              <span className="text-[11px] text-[var(--color-muted)]">to</span>
              <input
                type="time"
                value={draft.quietHours.endCT}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    quietHours: { ...d.quietHours, endCT: e.target.value },
                  }))
                }
                disabled={!draft.quietHours.enabled}
                className="px-2 py-1 rounded-lg glass text-xs tabular focus:outline-none focus:border-[var(--color-accent)] disabled:opacity-50"
              />
              <span className="text-[10px] text-[var(--color-muted)] uppercase tracking-wider ml-1">
                CT
              </span>
            </div>
          </div>
        </FieldRow>

        <FieldRow
          label="Desktop notifications"
          description="Show browser notifications for new fills and alerts (this tab must be open). Permission is requested when enabled."
        >
          <div className="flex flex-wrap items-center gap-3">
            <Toggle
              checked={draft.desktopNotificationsEnabled}
              onChange={toggleDesktop}
              label={draft.desktopNotificationsEnabled ? "On" : "Off"}
              disabled={mounted && !supported}
            />
            <span className="text-[11px] text-[var(--color-muted)]">
              {!mounted
                ? "Checking browser support…"
                : !supported
                ? "Not supported in this browser"
                : `Browser permission: ${permission}`}
            </span>
          </div>
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
