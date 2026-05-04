import { SettingsForm } from "@/components/settings/SettingsForm";
import { VaultKeyBanner } from "@/components/bots/VaultKeyBanner";
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
    </div>
  );
}
