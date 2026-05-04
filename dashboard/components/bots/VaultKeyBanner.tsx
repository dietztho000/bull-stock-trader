"use client";

import { useState } from "react";
import useSWR from "swr";
import { VaultKeyRotateButton } from "./VaultKeyRotateButton";
import { fmtRelativeTime } from "@/lib/format";

const fetcher = (u: string) => fetch(u).then((r) => r.json());

type RekeyDrift = { drifted: false } | { drifted: true; rekeyedAt: string };
type Health = { usingFallback: boolean; rekeyDrift?: RekeyDrift };

/** Dashboard-wide warning when `BULL_VAULT_KEY` isn't set in .env. The vault
 *  falls back to a deterministic key derived from machine fingerprint, which
 *  works for first-run convenience but means encrypted credentials cannot be
 *  moved to a different machine — and a `BULL_VAULT_KEY` set later won't
 *  decrypt anything stored under the fallback. Surface F5 from the audit.
 *
 *  When the vault IS healthy (real key set), surfaces a slim "Rotate vault
 *  key" affordance so the user can roll the key without losing accounts —
 *  audit F6. */
export function VaultKeyBanner() {
  const { data } = useSWR<Health>("/api/vault/health", fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 60_000,
  });
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Drift takes priority over every other state — when the on-disk
  // fingerprint marker says the vault was rekeyed since this process
  // started, every credential decrypt is failing. The user must restart.
  if (data?.rekeyDrift?.drifted) {
    return <RekeyDriftBanner rekeyedAt={data.rekeyDrift.rekeyedAt} />;
  }

  // Healthy: just expose the rotate affordance.
  if (data && !data.usingFallback) {
    return (
      <div className="flex justify-end">
        <VaultKeyRotateButton />
      </div>
    );
  }

  // Health unknown (initial fetch); render nothing to avoid layout flash.
  if (!data) return null;

  async function generate() {
    setBusy(true);
    setError(null);
    try {
      const resp = await fetch("/api/vault/generate-key", { method: "POST" });
      const body = await resp.json();
      if (!resp.ok) throw new Error(body.error ?? `HTTP ${resp.status}`);
      setGeneratedKey(body.key);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    if (!generatedKey) return;
    try {
      await navigator.clipboard.writeText(`BULL_VAULT_KEY=${generatedKey}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // older browser / permission denied — leave the textarea so users can copy manually
    }
  }

  return (
    <div className="rounded-xl border border-[var(--color-down)]/40 bg-[var(--color-down)]/10 px-4 py-3">
      <div className="flex items-start gap-3">
        <div className="text-[var(--color-down)] text-lg leading-none mt-0.5">⚠</div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-[var(--color-text)]">
            BULL_VAULT_KEY not set
          </div>
          <div className="text-xs text-[var(--color-muted)] leading-relaxed mt-1">
            Account credentials are being encrypted with a deterministic
            machine-derived fallback key. This works locally but means the
            credentials can&apos;t be moved to another machine, and any{" "}
            <code className="font-mono text-[var(--color-text)]">BULL_VAULT_KEY</code>{" "}
            you set later won&apos;t decrypt accounts saved under the fallback.{" "}
            <strong className="text-[var(--color-text)]">
              Generate a real key, then re-add any existing accounts.
            </strong>
          </div>
          {generatedKey ? (
            <div className="mt-3 space-y-2">
              <div className="text-[10px] uppercase tracking-[0.14em] text-[var(--color-muted)] font-semibold">
                Paste this into .env
              </div>
              <pre className="text-[11px] font-mono bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.08)] rounded-lg p-3 whitespace-pre-wrap break-all leading-relaxed">
                BULL_VAULT_KEY={generatedKey}
              </pre>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={copy}
                  className="glass rounded-full px-3 py-1.5 text-xs font-semibold"
                >
                  {copied ? "✓ Copied" : "Copy line"}
                </button>
                <span className="text-[10px] text-[var(--color-muted)]">
                  Then restart the dashboard process.
                </span>
              </div>
            </div>
          ) : (
            <div className="mt-2 flex items-center gap-3">
              <button
                type="button"
                onClick={generate}
                disabled={busy}
                className="glass rounded-full px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
              >
                {busy ? "Generating…" : "Generate one"}
              </button>
              {error && (
                <span className="text-[11px] text-[var(--color-down)]">{error}</span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** Renders when the on-disk vault fingerprint disagrees with the key the
 *  current process booted with — i.e. someone clicked Rotate but the
 *  dashboard wasn't restarted afterward. Every credential read in this
 *  process is failing; the only fix is a restart with the new key in env. */
function RekeyDriftBanner({ rekeyedAt }: { rekeyedAt: string }) {
  const ts = Date.parse(rekeyedAt);
  const ago = Number.isFinite(ts) ? fmtRelativeTime(ts) : "recently";
  return (
    <div className="rounded-xl border border-[var(--color-down)]/50 bg-[var(--color-down)]/15 px-4 py-3">
      <div className="flex items-start gap-3">
        <div className="text-[var(--color-down)] text-lg leading-none mt-0.5">⚠</div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-[var(--color-text)]">
            Vault rotated {ago} ago — restart required
          </div>
          <div className="text-xs text-[var(--color-muted)] leading-relaxed mt-1">
            The vault key was rotated since this dashboard process started. The
            running process still holds the previous key in memory, so every
            credential read (healthcheck, equity, orders) will fail until you{" "}
            <strong className="text-[var(--color-text)]">restart with the new key</strong>{" "}
            set in <code className="font-mono text-[var(--color-text)]">BULL_VAULT_KEY</code>.
            If you didn&apos;t do this rotation, check who has access to the
            dashboard host — and consider rotating again.
          </div>
        </div>
      </div>
    </div>
  );
}
