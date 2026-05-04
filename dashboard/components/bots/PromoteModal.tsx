"use client";

import { useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import type { Bot, RedactedAccount } from "@/lib/settings";
import type { DiffLine, PromoteDiff } from "@/lib/promote";

type PreviewResp = {
  source: { id: string; strategy: string };
  target: { id: string; strategy: string };
  diff: PromoteDiff;
};

type ApplyResp = PreviewResp & {
  wroteStrategy: boolean;
  wroteAnchor: boolean;
};

const CONFIRM_PHRASE = "I-CONFIRM-PROMOTE";

export function PromoteModal({
  source,
  bots,
  accounts,
  onClose,
  onSuccess,
}: {
  source: Bot;
  bots: Bot[];
  accounts: RedactedAccount[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const liveTargets = useMemo(() => {
    const liveAccountIds = new Set(
      accounts.filter((a) => a.mode === "live").map((a) => a.id)
    );
    return bots.filter((b) => liveAccountIds.has(b.accountId) && b.id !== source.id);
  }, [bots, accounts, source.id]);

  const [targetId, setTargetId] = useState(liveTargets[0]?.id ?? "");
  const [preview, setPreview] = useState<PreviewResp | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [applying, setApplying] = useState(false);
  const [applied, setApplied] = useState<ApplyResp | null>(null);
  const [applyError, setApplyError] = useState<string | null>(null);

  useEffect(() => {
    if (!targetId) return;
    setPreview(null);
    setPreviewError(null);
    setApplied(null);
    setApplyError(null);
    setConfirmText("");
    let cancelled = false;
    setPreviewing(true);
    fetch("/api/bots/promote", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        sourceBotId: source.id,
        targetBotId: targetId,
        dryRun: true,
      }),
    })
      .then(async (r) => {
        const data = await r.json();
        if (cancelled) return;
        if (!r.ok) {
          setPreviewError(data.error ?? `HTTP ${r.status}`);
          return;
        }
        setPreview(data);
      })
      .catch((err) => {
        if (!cancelled) setPreviewError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        if (!cancelled) setPreviewing(false);
      });
    return () => {
      cancelled = true;
    };
  }, [source.id, targetId]);

  async function apply() {
    if (confirmText !== CONFIRM_PHRASE || !targetId) return;
    setApplying(true);
    setApplyError(null);
    try {
      const r = await fetch("/api/bots/promote", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          sourceBotId: source.id,
          targetBotId: targetId,
          confirm: CONFIRM_PHRASE,
        }),
      });
      const data = await r.json();
      if (!r.ok) {
        setApplyError(data.error ?? `HTTP ${r.status}`);
        return;
      }
      setApplied(data as ApplyResp);
      onSuccess();
    } catch (err) {
      setApplyError(err instanceof Error ? err.message : String(err));
    } finally {
      setApplying(false);
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
        className="frost rounded-2xl p-5 w-full max-w-2xl mt-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold">
            Promote {source.name} → live
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

        {liveTargets.length === 0 ? (
          <div className="text-xs text-[var(--color-muted)] py-2">
            No live bots configured. Add a live-mode account and bot at /bots
            first; this dialog will then let you copy{" "}
            <code className="font-mono">{source.id}</code>&apos;s
            TRADING-STRATEGY.md over it.
          </div>
        ) : applied ? (
          <SuccessView applied={applied} onClose={onClose} />
        ) : (
          <div className="space-y-3">
            <label className="block text-xs">
              <div className="font-semibold mb-1">Target live bot</div>
              <select
                value={targetId}
                onChange={(e) => setTargetId(e.target.value)}
                className="w-full rounded-lg bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.08)] px-3 py-1.5 text-sm focus:outline-none focus:border-[var(--color-accent)]"
              >
                {liveTargets.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({b.id})
                  </option>
                ))}
              </select>
              <div className="text-[10px] text-[var(--color-muted)] mt-1">
                Replaces this bot&apos;s{" "}
                <code className="font-mono">TRADING-STRATEGY.md</code> and
                appends a dated anchor to its TRADE-LOG.
              </div>
            </label>

            <DiffPreview
              previewing={previewing}
              error={previewError}
              preview={preview}
            />

            {preview && !preview.diff.identical && (
              <div className="space-y-2 pt-1">
                <label className="block text-xs">
                  <div className="font-semibold text-[var(--color-warn)] mb-1">
                    Type <code className="font-mono">{CONFIRM_PHRASE}</code> to authorize:
                  </div>
                  <input
                    type="text"
                    value={confirmText}
                    onChange={(e) => setConfirmText(e.target.value)}
                    className="w-full rounded-lg bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.08)] px-3 py-1.5 text-sm font-mono focus:outline-none focus:border-[var(--color-accent)]"
                  />
                </label>
                {applyError && (
                  <div className="text-xs text-[var(--color-down)]">{applyError}</div>
                )}
                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={onClose}
                    className="glass rounded-full px-3 py-1.5 text-xs"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={apply}
                    disabled={confirmText !== CONFIRM_PHRASE || applying}
                    className={clsx(
                      "glass glass-tint-down rounded-full px-3 py-1.5 text-xs font-semibold",
                      (confirmText !== CONFIRM_PHRASE || applying) &&
                        "opacity-50 cursor-not-allowed"
                    )}
                  >
                    {applying ? "Promoting…" : "Promote to live"}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function DiffPreview({
  previewing,
  error,
  preview,
}: {
  previewing: boolean;
  error: string | null;
  preview: PreviewResp | null;
}) {
  if (previewing) {
    return <div className="text-xs text-[var(--color-muted)]">Loading diff…</div>;
  }
  if (error) {
    return <div className="text-xs text-[var(--color-down)]">{error}</div>;
  }
  if (!preview) return null;
  if (preview.diff.identical) {
    return (
      <div className="rounded-lg border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] p-3 text-xs text-[var(--color-muted)]">
        ✓ Strategy files are identical — nothing to promote.
      </div>
    );
  }
  return (
    <div className="space-y-1.5">
      <div className="text-[10px] uppercase tracking-[0.14em] text-[var(--color-muted)] font-semibold flex items-center gap-2">
        Diff
        <span className="text-[var(--color-up)]">+{preview.diff.added}</span>
        <span className="text-[var(--color-down)]">−{preview.diff.removed}</span>
        <span className="text-[var(--color-muted)] ml-auto">
          target {preview.target.id} ← source {preview.source.id}
        </span>
      </div>
      <pre className="text-[11px] font-mono leading-snug bg-[rgba(0,0,0,0.3)] rounded-lg p-3 max-h-[40vh] overflow-auto">
        {preview.diff.lines.map((l, i) => (
          <DiffRow key={i} line={l} />
        ))}
      </pre>
    </div>
  );
}

function DiffRow({ line }: { line: DiffLine }) {
  const cls =
    line.kind === "+"
      ? "text-[var(--color-up)] bg-[var(--color-up)]/10"
      : line.kind === "-"
      ? "text-[var(--color-down)] bg-[var(--color-down)]/10"
      : "text-[var(--color-muted)]";
  return (
    <div className={clsx("whitespace-pre-wrap break-all px-1", cls)}>
      <span className="select-none mr-1">{line.kind}</span>
      {line.text || " "}
    </div>
  );
}

function SuccessView({
  applied,
  onClose,
}: {
  applied: ApplyResp;
  onClose: () => void;
}) {
  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-[var(--color-up)]/40 bg-[var(--color-up)]/10 p-3 text-xs text-[var(--color-text)]">
        ✓ Promoted{" "}
        <code className="font-mono">{applied.source.id}</code> →{" "}
        <code className="font-mono">{applied.target.id}</code>.
        <ul className="mt-2 list-disc list-inside text-[11px] text-[var(--color-muted)]">
          <li>
            Wrote <code className="font-mono">TRADING-STRATEGY.md</code> ({applied.wroteStrategy ? "updated" : "no change"})
          </li>
          <li>
            Appended TRADE-LOG anchor ({applied.wroteAnchor ? "yes" : "already present"})
          </li>
          <li>
            +{applied.diff.added} / −{applied.diff.removed} line changes
          </li>
        </ul>
      </div>
      <div className="text-[10px] text-[var(--color-muted)]">
        Commit the change with <code className="font-mono">git add memory/{applied.target.id}/ &amp;&amp; git commit</code> when you&apos;re ready.
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
  );
}
