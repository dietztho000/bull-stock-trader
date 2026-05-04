"use client";

import { useState } from "react";

/** Audit F6 — vault-key rotation UI.
 *
 *  Three-step flow guarded by an explicit confirmation:
 *    1. Generate (or paste) a new 32-byte base64 key.
 *    2. POST /api/vault/rekey — server re-encrypts all account creds under
 *       the new key, writes a backup of the previous settings.json.
 *    3. UI shows the new key and unmistakable restart instructions.
 *
 *  Critical UX: the running process still holds the OLD key in env, so the
 *  banner stays visible after rotation until the user restarts. We don't
 *  attempt to mutate process.env (Node's env is fixed at start). */
export function VaultKeyRotateButton() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"prepare" | "confirm" | "done" | "error">(
    "prepare"
  );
  const [newKey, setNewKey] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<{
    reencrypted: number;
    backupPath: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  function reset() {
    setStep("prepare");
    setNewKey(null);
    setError(null);
    setReport(null);
    setCopied(false);
  }

  async function generate() {
    setBusy(true);
    setError(null);
    try {
      const resp = await fetch("/api/vault/generate-key", { method: "POST" });
      const body = await resp.json();
      if (!resp.ok) throw new Error(body.error ?? `HTTP ${resp.status}`);
      setNewKey(body.key);
      setStep("confirm");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function rotate() {
    if (!newKey) return;
    setBusy(true);
    setError(null);
    try {
      const resp = await fetch("/api/vault/rekey", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ newKey }),
      });
      const body = await resp.json();
      if (!resp.ok || !body.ok) {
        throw new Error(body.error ?? `HTTP ${resp.status}`);
      }
      setReport({ reencrypted: body.reencrypted, backupPath: body.backupPath });
      setStep("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setStep("error");
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    if (!newKey) return;
    try {
      await navigator.clipboard.writeText(`BULL_VAULT_KEY=${newKey}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Old browser / permission denied — leave the value visible to copy manually.
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => {
          reset();
          setOpen(true);
        }}
        className="text-[11px] text-[var(--color-muted)] hover:text-[var(--color-text)] underline underline-offset-2"
      >
        Rotate vault key
      </button>
    );
  }

  return (
    <div className="rounded-xl border border-[var(--color-warn)]/40 bg-[var(--color-warn)]/10 px-4 py-3 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold">Rotate vault key</div>
          <div className="text-[11px] text-[var(--color-muted)] mt-0.5">
            Re-encrypts every account credential under a new master key. The
            running dashboard keeps the old key in memory — you must restart
            after rotation for credential-bound operations to work again.
          </div>
        </div>
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Close"
          className="text-[var(--color-muted)] hover:text-[var(--color-text)] text-lg leading-none"
        >
          ×
        </button>
      </div>

      {step === "prepare" && (
        <div className="space-y-3">
          <p className="text-xs text-[var(--color-muted)]">
            Click <strong>Generate new key</strong> to create one. You&apos;ll
            review and confirm the rotation before it persists.
          </p>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={generate}
              disabled={busy}
              className="glass rounded-full px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
            >
              {busy ? "Generating…" : "Generate new key"}
            </button>
            {error && (
              <span className="text-[11px] text-[var(--color-down)]">
                {error}
              </span>
            )}
          </div>
        </div>
      )}

      {step === "confirm" && newKey && (
        <div className="space-y-3">
          <div className="text-[10px] uppercase tracking-[0.14em] text-[var(--color-muted)] font-semibold">
            Proposed new key
          </div>
          <pre className="text-[11px] font-mono bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.08)] rounded-lg p-3 whitespace-pre-wrap break-all leading-relaxed">
            BULL_VAULT_KEY={newKey}
          </pre>
          <div className="text-[11px] text-[var(--color-muted)] leading-relaxed">
            <strong className="text-[var(--color-warn)]">
              Save this somewhere safe before continuing.
            </strong>{" "}
            Once you click Rotate, settings.json will be re-encrypted under
            this key. If you lose it, every account&apos;s credentials are
            unrecoverable. A timestamped backup of the current settings.json
            stays on disk for emergency recovery.
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={copy}
              className="glass rounded-full px-3 py-1.5 text-[11px] font-semibold"
            >
              {copied ? "✓ Copied" : "Copy"}
            </button>
            <button
              type="button"
              onClick={rotate}
              disabled={busy}
              className="glass glass-tint-down rounded-full px-3 py-1.5 text-[11px] font-semibold disabled:opacity-50"
            >
              {busy ? "Rotating…" : "I saved it — Rotate now"}
            </button>
            <button
              type="button"
              onClick={reset}
              className="text-[11px] text-[var(--color-muted)] hover:text-[var(--color-text)] underline underline-offset-2"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {step === "done" && report && newKey && (
        <div className="space-y-3">
          <div className="text-xs text-[var(--color-up)]">
            ✓ Re-encrypted {report.reencrypted} account
            {report.reencrypted === 1 ? "" : "s"}.
          </div>
          <div className="text-[11px] text-[var(--color-muted)]">
            Backup saved to{" "}
            <code className="font-mono break-all">{report.backupPath}</code>.
          </div>
          <div className="rounded-lg border border-[var(--color-down)]/30 bg-[var(--color-down)]/10 p-3 space-y-2">
            <div className="text-xs font-semibold text-[var(--color-down)]">
              ⚠ Restart required
            </div>
            <ol className="text-[11px] text-[var(--color-muted)] list-decimal list-inside leading-relaxed space-y-0.5">
              <li>
                Update <code className="font-mono">BULL_VAULT_KEY</code> in your
                dashboard <code className="font-mono">.env</code>.
              </li>
              <li>
                Restart the dashboard (and any cloud routines sharing .env).
              </li>
              <li>
                Until restart, healthcheck / orders / equity all fail because
                the running process still holds the previous key.
              </li>
            </ol>
            <pre className="text-[11px] font-mono bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.08)] rounded-lg p-2 whitespace-pre-wrap break-all leading-relaxed">
              BULL_VAULT_KEY={newKey}
            </pre>
            <button
              type="button"
              onClick={copy}
              className="glass rounded-full px-3 py-1 text-[11px] font-semibold"
            >
              {copied ? "✓ Copied" : "Copy line"}
            </button>
          </div>
        </div>
      )}

      {step === "error" && (
        <div className="space-y-2">
          <div className="text-xs text-[var(--color-down)] break-words">
            Rotation failed: {error ?? "unknown error"}
          </div>
          <div className="text-[11px] text-[var(--color-muted)]">
            settings.json was not modified. Try again, or check the server
            logs for details.
          </div>
          <button
            type="button"
            onClick={reset}
            className="glass rounded-full px-3 py-1.5 text-[11px] font-semibold"
          >
            Start over
          </button>
        </div>
      )}
    </div>
  );
}
