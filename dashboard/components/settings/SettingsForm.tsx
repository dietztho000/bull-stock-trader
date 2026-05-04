"use client";

import { useState } from "react";
import { Card } from "@/components/ui/Card";
import type { RedactedSettings, SectionKey } from "@/lib/settings.schema";
import { DiscordSection } from "./DiscordSection";
import { DisplaySection } from "./DisplaySection";
import { LiveDataSection } from "./LiveDataSection";
import { DefaultsSection } from "./DefaultsSection";
import { NotificationsSection } from "./NotificationsSection";
import { MascotSection } from "./MascotSection";
import { StrategySection } from "./StrategySection";
import { AlertsSection } from "./AlertsSection";
import { SettingsImportExport } from "./SettingsImportExport";

export function SettingsForm({ initial }: { initial: RedactedSettings }) {
  const [redacted, setRedacted] = useState<RedactedSettings>(initial);
  const [resetError, setResetError] = useState<string | null>(null);

  async function resetSection(section: SectionKey) {
    setResetError(null);
    try {
      const resp = await fetch("/api/settings/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ section }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        setResetError(data?.error ?? `HTTP ${resp.status}`);
        return;
      }
      setRedacted(data);
    } catch (err) {
      setResetError(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <div className="space-y-5">
      {resetError && (
        <Card title="Reset error">
          <div className="text-xs text-[var(--color-down)] break-all">{resetError}</div>
        </Card>
      )}

      <Card title="Accounts & Bots">
        <div className="text-xs text-[var(--color-muted)] leading-relaxed">
          Alpaca accounts, bot definitions, capital allocations, and the
          encrypted credential vault are all managed at{" "}
          <a
            href="/bots"
            className="text-[var(--color-accent)] font-semibold hover:underline"
          >
            /bots
          </a>
          . Settings on this page only cover dashboard preferences.
        </div>
      </Card>

      <DisplaySection
        initial={redacted.display}
        onSaved={setRedacted}
        onResetSection={() => resetSection("display")}
      />
      <LiveDataSection
        initial={redacted.live}
        onSaved={setRedacted}
        onResetSection={() => resetSection("live")}
      />
      <DefaultsSection
        initial={redacted.defaults}
        onSaved={setRedacted}
        onResetSection={() => resetSection("defaults")}
      />
      <NotificationsSection
        initial={redacted.notifications}
        onSaved={setRedacted}
        onResetSection={() => resetSection("notifications")}
      />
      <MascotSection
        initial={redacted.mascot}
        onSaved={setRedacted}
        onResetSection={() => resetSection("mascot")}
      />
      <StrategySection
        initial={redacted.strategy}
        onSaved={setRedacted}
        onResetSection={() => resetSection("strategy")}
      />
      <AlertsSection
        initial={redacted.alerts}
        onSaved={setRedacted}
        onResetSection={() => resetSection("alerts")}
      />
      <DiscordSection
        redacted={redacted}
        onChange={setRedacted}
        onResetSection={() => resetSection("discord")}
      />
      <SettingsImportExport onChange={setRedacted} />

      <Card title="What this overrides">
        <div className="text-xs text-[var(--color-muted)] leading-relaxed space-y-2">
          <p>
            Settings are stored in{" "}
            <code className="font-mono text-[var(--color-text)]">memory/shared/dashboard-settings.json</code>{" "}
            (gitignored). Display, refresh, defaults, and notification filters affect the
            dashboard only.
          </p>
          <p>
            <strong>The bot's CLI routines do NOT see these overrides.</strong> They read
            from <code className="font-mono text-[var(--color-text)]">.env</code> directly.
            To change the bot's webhook, edit{" "}
            <code className="font-mono text-[var(--color-text)]">.env</code>.
          </p>
          <p>
            Quiet hours and category filters apply only to dashboard-originated sends (e.g.
            the “Send test message” path), not to scheduled cron messages.
          </p>
        </div>
      </Card>
    </div>
  );
}
