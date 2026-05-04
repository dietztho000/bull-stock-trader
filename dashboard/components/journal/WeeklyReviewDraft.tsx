"use client";

import { useState } from "react";
import { Card } from "@/components/ui/Card";

type DraftResp = {
  draft: string;
  weekEnding: string;
  generatedAt: string;
  cacheHit: boolean;
};

/** Audit F10 — one-click weekly-review draft for the active bot.
 *
 *  Posts to `/api/ai/weekly-review-draft?bot=<id>` and renders the
 *  generated markdown in an editable textarea. The draft is intentionally
 *  NOT auto-committed to WEEKLY-REVIEW.md — the operator reviews + edits
 *  before pasting in (a writeable endpoint would risk overwriting the
 *  Friday routine's authoritative entry). */
export function WeeklyReviewDraft({ botId }: { botId: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resp, setResp] = useState<DraftResp | null>(null);
  const [draft, setDraft] = useState("");
  const [copied, setCopied] = useState(false);

  async function generate() {
    setBusy(true);
    setError(null);
    setResp(null);
    try {
      const r = await fetch(
        `/api/ai/weekly-review-draft?bot=${encodeURIComponent(botId)}`,
        { method: "POST" }
      );
      const body = await r.json();
      if (!r.ok) throw new Error(body.error ?? `HTTP ${r.status}`);
      setResp(body as DraftResp);
      setDraft(body.draft);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    if (!draft) return;
    try {
      await navigator.clipboard.writeText(draft);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Old browser / permission denied — leave the textarea visible.
    }
  }

  return (
    <Card
      title="Weekly review draft"
      subtitle="AI-generated from this week's trades + benchmark. Edit, then paste into WEEKLY-REVIEW.md."
      right={
        resp ? (
          <span className="text-[10px] text-[var(--color-muted)]">
            {resp.cacheHit ? "cached" : "fresh"} ·{" "}
            {new Date(resp.generatedAt).toLocaleTimeString()}
          </span>
        ) : null
      }
    >
      {!resp && !error && (
        <div className="space-y-3">
          <p className="text-xs text-[var(--color-muted)] leading-relaxed">
            Generates a Friday-template draft (Stats / What worked / What
            didn&apos;t / Adjustments / Grade) from this week&apos;s closed
            trades + BENCHMARK rows. Output is editable; nothing gets written
            to memory until you paste it into WEEKLY-REVIEW.md yourself.
          </p>
          <button
            type="button"
            onClick={generate}
            disabled={busy}
            className="glass glass-tint-accent rounded-full px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
          >
            {busy ? "Generating…" : "Generate draft"}
          </button>
        </div>
      )}

      {error && (
        <div className="space-y-2">
          <div className="text-xs text-[var(--color-down)] break-words">
            {error}
          </div>
          <button
            type="button"
            onClick={generate}
            className="glass rounded-full px-3 py-1.5 text-xs font-semibold"
          >
            Retry
          </button>
        </div>
      )}

      {resp && (
        <div className="space-y-3">
          <div className="text-[11px] text-[var(--color-muted)]">
            Week ending{" "}
            <code className="font-mono text-[var(--color-text)]">
              {resp.weekEnding}
            </code>
            . Edit below as needed before copying.
          </div>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            spellCheck
            rows={20}
            className="w-full font-mono text-[11px] leading-relaxed rounded-lg bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.08)] px-3 py-2 focus:outline-none focus:border-[var(--color-accent)] resize-y"
          />
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={generate}
              disabled={busy}
              className="text-[11px] text-[var(--color-muted)] hover:text-[var(--color-text)] underline underline-offset-2 disabled:opacity-50"
            >
              {busy ? "Regenerating…" : "Regenerate"}
            </button>
            <button
              type="button"
              onClick={copy}
              className="glass rounded-full px-3 py-1.5 text-xs font-semibold"
            >
              {copied ? "✓ Copied" : "Copy markdown"}
            </button>
          </div>
        </div>
      )}
    </Card>
  );
}
