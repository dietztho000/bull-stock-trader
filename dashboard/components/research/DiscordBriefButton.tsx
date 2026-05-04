"use client";

import { useEffect, useState, useCallback } from "react";
import clsx from "clsx";
import { Badge } from "@/components/ui/Card";
import { useToastOptional } from "@/components/providers/ToastProvider";

type Warning = { source: string; message: string };

type FetchState =
  | { kind: "idle" }
  | { kind: "loading" }
  | {
      kind: "ready";
      message: string;
      warnings: Warning[];
      stats: { earningsToday: number; economicToday: number; positions: number; hasHighImpact: boolean };
    }
  | { kind: "error"; message: string };

type SendState =
  | { kind: "idle" }
  | { kind: "sending" }
  | { kind: "sent"; delivery: "webhook" | "fallback-file" | "ntfy-only" }
  | { kind: "error"; message: string };

export function DiscordBriefButton() {
  const toast = useToastOptional();
  const [open, setOpen] = useState(false);
  const [fetchState, setFetchState] = useState<FetchState>({ kind: "idle" });
  const [sendState, setSendState] = useState<SendState>({ kind: "idle" });
  const [copied, setCopied] = useState(false);

  const loadPreview = useCallback(async () => {
    setFetchState({ kind: "loading" });
    setSendState({ kind: "idle" });
    setCopied(false);
    try {
      const resp = await fetch("/api/discord/brief", { method: "GET" });
      const data = await resp.json();
      if (!resp.ok) {
        setFetchState({ kind: "error", message: data?.error ?? `HTTP ${resp.status}` });
        return;
      }
      setFetchState({
        kind: "ready",
        message: data.message,
        warnings: Array.isArray(data.warnings) ? data.warnings : [],
        stats: data.stats,
      });
    } catch (err) {
      setFetchState({
        kind: "error",
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }, []);

  function openModal() {
    setOpen(true);
    void loadPreview();
  }

  function closeModal() {
    setOpen(false);
  }

  // Esc to close
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") closeModal();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  async function copyToClipboard() {
    if (fetchState.kind !== "ready") return;
    try {
      await navigator.clipboard.writeText(fetchState.message);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (err) {
      toast?.push({
        tone: "error",
        title: "Couldn't copy to clipboard",
        detail: err instanceof Error ? err.message : String(err),
      });
    }
  }

  async function sendNow() {
    if (fetchState.kind !== "ready") return;
    setSendState({ kind: "sending" });
    try {
      const resp = await fetch("/api/discord/brief", { method: "POST" });
      const data = await resp.json();
      if (!resp.ok) {
        const msg = data?.error ?? `HTTP ${resp.status}`;
        setSendState({ kind: "error", message: msg });
        toast?.push({ tone: "error", title: "Discord send failed", detail: msg });
        return;
      }
      setSendState({ kind: "sent", delivery: data.delivery });
      if (data.delivery === "webhook") {
        toast?.push({ tone: "success", title: "Brief sent to Discord" });
      } else if (data.delivery === "fallback-file") {
        toast?.push({
          tone: "warn",
          title: "Webhook not set",
          detail: "Brief was appended to memory/DAILY-SUMMARY.md instead.",
        });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setSendState({ kind: "error", message: msg });
      toast?.push({ tone: "error", title: "Discord send failed", detail: msg });
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={openModal}
        className={clsx(
          "inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded",
          "border border-[var(--color-accent)] bg-[var(--color-accent)] text-black",
          "hover:opacity-90 transition-opacity"
        )}
      >
        <span>🔬</span>
        <span>Pre-Market Discord Brief</span>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 sm:p-6"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeModal();
          }}
        >
          <div
            className="w-full max-w-2xl max-h-[90vh] flex flex-col rounded-lg border border-[var(--color-border)] bg-[var(--color-panel)] shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-label="Pre-Market Discord Brief"
          >
            <header className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border)]">
              <div>
                <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--color-muted)]">
                  Pre-Market Discord Brief
                </h2>
                <p className="text-xs text-[var(--color-muted)] mt-0.5">
                  Today's earnings + economic events, formatted for Discord.
                </p>
              </div>
              <button
                type="button"
                onClick={closeModal}
                className="text-[var(--color-muted)] hover:text-[var(--color-text)] text-xl leading-none px-2"
                aria-label="Close"
              >
                ×
              </button>
            </header>

            <div className="flex-1 overflow-auto p-4">
              {fetchState.kind === "loading" && (
                <div className="text-xs text-[var(--color-muted)] py-8 text-center">
                  Assembling brief…
                </div>
              )}
              {fetchState.kind === "error" && (
                <div className="rounded border border-red-500/30 bg-red-500/10 p-3 text-xs">
                  <div className="text-[var(--color-down)] font-semibold mb-1">
                    Failed to assemble brief
                  </div>
                  <div className="font-mono break-all opacity-80">{fetchState.message}</div>
                  <button
                    type="button"
                    onClick={loadPreview}
                    className="mt-2 px-2 py-1 text-[11px] rounded border border-[var(--color-border)] bg-[var(--color-panel-2)]"
                  >
                    Retry
                  </button>
                </div>
              )}
              {fetchState.kind === "ready" && (
                <>
                  <div className="flex flex-wrap items-center gap-1.5 mb-3 text-[11px]">
                    <Badge tone="up">{fetchState.stats.earningsToday} earnings</Badge>
                    <Badge tone="neutral">{fetchState.stats.economicToday} economic</Badge>
                    <Badge tone="neutral">{fetchState.stats.positions} positions</Badge>
                    {fetchState.stats.hasHighImpact && <Badge tone="warn">high impact</Badge>}
                  </div>
                  {fetchState.warnings.length > 0 && (
                    <div className="mb-3 rounded border border-[var(--color-warn)]/30 bg-[var(--color-warn)]/10 p-2.5">
                      <div className="text-[11px] text-[var(--color-warn)] font-semibold mb-1">
                        Some sources failed to load — brief may be incomplete
                      </div>
                      <ul className="space-y-0.5">
                        {fetchState.warnings.map((w, i) => (
                          <li key={i} className="text-[11px] text-[var(--color-muted)]">
                            <span className="font-medium text-[var(--color-text)]">{w.source}:</span>{" "}
                            <span className="font-mono break-all">{w.message}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <pre className="whitespace-pre-wrap text-xs leading-relaxed font-mono bg-[var(--color-panel-2)] border border-[var(--color-border)] rounded p-3 text-[var(--color-text)]">
                    {fetchState.message}
                  </pre>
                </>
              )}
            </div>

            <footer className="border-t border-[var(--color-border)] px-4 py-3 flex flex-wrap items-center justify-between gap-2">
              <div className="text-[11px] min-h-[20px]">
                {sendState.kind === "sent" && sendState.delivery === "webhook" && (
                  <span className="text-[var(--color-up)]">✓ Sent to Discord</span>
                )}
                {sendState.kind === "sent" && sendState.delivery === "fallback-file" && (
                  <span className="text-[var(--color-warn)]">
                    Webhook not set — appended to DAILY-SUMMARY.md
                  </span>
                )}
                {sendState.kind === "sent" && sendState.delivery === "ntfy-only" && (
                  <span className="text-[var(--color-muted)]">Sent via ntfy.sh only</span>
                )}
                {sendState.kind === "error" && (
                  <span className="text-[var(--color-down)] truncate max-w-[300px] inline-block" title={sendState.message}>
                    Send failed: {sendState.message}
                  </span>
                )}
                {copied && <span className="text-[var(--color-up)]">Copied!</span>}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={copyToClipboard}
                  disabled={fetchState.kind !== "ready"}
                  className={clsx(
                    "px-3 py-1.5 text-xs rounded border border-[var(--color-border)]",
                    "bg-[var(--color-panel)] hover:bg-[var(--color-panel-2)]",
                    fetchState.kind !== "ready" && "opacity-50 cursor-not-allowed"
                  )}
                >
                  Copy to clipboard
                </button>
                <button
                  type="button"
                  onClick={sendNow}
                  disabled={fetchState.kind !== "ready" || sendState.kind === "sending"}
                  className={clsx(
                    "px-3 py-1.5 text-xs font-medium rounded",
                    "bg-[var(--color-accent)] text-black hover:opacity-90",
                    (fetchState.kind !== "ready" || sendState.kind === "sending") &&
                      "opacity-50 cursor-not-allowed"
                  )}
                >
                  {sendState.kind === "sending" ? "Sending…" : "Send to Discord"}
                </button>
              </div>
            </footer>
          </div>
        </div>
      )}
    </>
  );
}
