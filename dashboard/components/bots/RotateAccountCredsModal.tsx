"use client";

import { useEffect, useRef, useState } from "react";
import { mutate } from "swr";
import type { RedactedAccount } from "@/lib/settings";

const ACCOUNTS_URL = "/api/accounts";

/** Follow-up #3 — paste new credentials for an existing account.
 *
 *  Reached from a failed HealthDot's click-to-fix affordance: the user has
 *  revoked or rotated the underlying Alpaca keys, and the dashboard needs
 *  fresh ones without forcing a delete + recreate (which would lose any
 *  bots bound to this account). The PATCH endpoint encrypts the keys
 *  server-side before persisting. */
export function RotateAccountCredsModal({
  account,
  onClose,
}: {
  account: RedactedAccount;
  onClose: () => void;
}) {
  const [apiKey, setApiKey] = useState("");
  const [secretKey, setSecretKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const apiKeyRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    apiKeyRef.current?.focus();
  }, []);

  async function onTest() {
    setBusy(true);
    setError(null);
    setTestResult(null);
    try {
      const resp = await fetch("/api/accounts/__test__/test", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          endpoint: account.endpoint,
          apiKey,
          secretKey,
        }),
      });
      const body = await resp.json();
      if (body.ok) {
        setTestResult(`✓ Reached Alpaca — account ${body.accountNumber ?? "(no #)"}`);
      } else {
        setError(body.error ?? "Test failed");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const resp = await fetch(`${ACCOUNTS_URL}/${encodeURIComponent(account.id)}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ apiKey, secretKey }),
      });
      const body = await resp.json();
      if (!resp.ok) {
        setError(body.error ?? `HTTP ${resp.status}`);
        return;
      }
      mutate(ACCOUNTS_URL);
      // The healthcheck SWR keys are per-bot (not per-account), so revalidate
      // any cached failure state for this account's bots — they'll re-probe
      // with the fresh credentials on the next refresh anyway, but nudging
      // SWR avoids the user staring at a stale red dot for up to 60s.
      mutate(
        (key) =>
          typeof key === "string" && key.startsWith("/api/bots/") && key.endsWith("/healthcheck")
      );
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="frost rounded-2xl p-5 w-full max-w-md mt-12"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold">
            Rotate credentials — {account.label}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-[var(--color-muted)] hover:text-[var(--color-text)] text-lg leading-none"
          >
            ×
          </button>
        </div>

        {done ? (
          <div className="space-y-3 text-xs">
            <div className="text-[var(--color-up)]">
              ✓ Credentials updated for{" "}
              <code className="font-mono">{account.id}</code>. The next health
              probe will use the new keys.
            </div>
            <div className="text-[var(--color-muted)]">
              Bots bound to this account auto-re-enable themselves only on the
              next sentinel cycle — re-enable them manually from the bot card
              if they were auto-disabled.
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={onClose}
                className="glass glass-tint-up rounded-full px-3 py-1.5 text-xs font-semibold"
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="space-y-3">
            <p className="text-[11px] text-[var(--color-muted)] leading-relaxed">
              Paste new <strong>{account.mode}</strong> credentials for this
              account. The dashboard will encrypt and persist them; existing
              bots stay bound — no rebinding needed.
            </p>
            <Field label="New API key">
              <input
                ref={apiKeyRef}
                required
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                autoComplete="off"
                className={inputClass}
              />
            </Field>
            <Field label="New secret key">
              <input
                required
                type="password"
                value={secretKey}
                onChange={(e) => setSecretKey(e.target.value)}
                autoComplete="off"
                className={inputClass}
              />
            </Field>

            {testResult && (
              <div className="text-xs text-[var(--color-up)]">{testResult}</div>
            )}
            {error && (
              <div className="text-xs text-[var(--color-down)] break-all">
                {error}
              </div>
            )}

            <div className="flex items-center justify-between pt-1">
              <button
                type="button"
                onClick={onTest}
                disabled={busy || !apiKey || !secretKey}
                className="text-xs underline underline-offset-2 disabled:opacity-50"
              >
                Test connection
              </button>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="glass rounded-full px-3 py-1.5 text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={busy || !apiKey || !secretKey}
                  className="glass glass-tint-up rounded-full px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
                >
                  {busy ? "Saving…" : "Save credentials"}
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

const inputClass =
  "w-full rounded-lg bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.08)] px-3 py-1.5 text-sm focus:outline-none focus:border-[var(--color-accent)]";

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block text-xs">
      <div className="font-semibold mb-1">{label}</div>
      {children}
    </label>
  );
}
