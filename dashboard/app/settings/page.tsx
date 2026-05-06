import Link from "next/link";
import { SettingsForm } from "@/components/settings/SettingsForm";
import { VaultKeyBanner } from "@/components/bots/VaultKeyBanner";
import { Card } from "@/components/ui/Card";
import { loadRedactedSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function SettingsPage() {
  const initial = await loadRedactedSettings();

  return (
    <div className="space-y-5 max-w-3xl">
      <VaultKeyBanner />

      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-xs text-[var(--color-muted)] mt-0.5">
          Per-machine dashboard preferences · stored in{" "}
          <code className="font-mono">memory/shared/dashboard-settings.json</code> (gitignored).
        </p>
      </header>

      <SettingsForm initial={initial} />

      {/* Audit U2 — operators routinely look here for "bot/account stuff"
          (creds, allocation, sentinels). Point them at the dedicated
          /bots admin page so settings stays scoped to per-machine prefs. */}
      <Card title="Looking for bot or account settings?">
        <div className="space-y-2 text-sm">
          <p className="text-[var(--color-muted)] leading-relaxed">
            Alpaca account credentials, bot bindings, capital allocation, and
            the auto-disable sentinel all live on a dedicated admin page so
            this form can stay focused on per-machine preferences.
          </p>
          <Link
            href="/bots"
            className="inline-block text-[var(--color-accent)] hover:underline text-xs font-semibold"
          >
            Open /bots →
          </Link>
        </div>
      </Card>
    </div>
  );
}
