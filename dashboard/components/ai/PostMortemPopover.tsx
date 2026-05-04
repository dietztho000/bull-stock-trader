"use client";

import { useEffect, useState } from "react";
import { marked } from "marked";
import { useTradingAccountOptional } from "@/lib/tradingAccountContext";

type State =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "ready"; text: string }
  | { kind: "error"; message: string };

function cacheKey(symbol: string, entryDate: string | null, botId: string | null) {
  return `pm:${botId ?? "default"}:${symbol.toUpperCase()}:${entryDate ?? ""}`;
}

export function PostMortemButton({
  symbol,
  entryDate,
}: {
  symbol: string;
  entryDate: string | null;
}) {
  const ctx = useTradingAccountOptional();
  const botId = ctx?.botId ?? null;
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<State>({ kind: "idle" });

  useEffect(() => {
    if (!open || state.kind !== "idle") return;
    const cached = sessionStorage.getItem(cacheKey(symbol, entryDate, botId));
    if (cached) {
      setState({ kind: "ready", text: cached });
      return;
    }
    let cancelled = false;
    setState({ kind: "loading" });
    const qs = botId ? `?bot=${encodeURIComponent(botId)}` : "";
    fetch(`/api/ai/post-mortem${qs}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ symbol, entryDate }),
    })
      .then(async (r) => {
        const data = await r.json();
        if (cancelled) return;
        if (!r.ok || data.error) {
          setState({ kind: "error", message: data.error ?? `HTTP ${r.status}` });
          return;
        }
        sessionStorage.setItem(cacheKey(symbol, entryDate, botId), data.text);
        setState({ kind: "ready", text: data.text });
      })
      .catch((err) => {
        if (cancelled) return;
        setState({
          kind: "error",
          message: err instanceof Error ? err.message : "request failed",
        });
      });
    return () => {
      cancelled = true;
    };
  }, [open, state.kind, symbol, entryDate, botId]);

  return (
    <div className="relative inline-block">
      <button
        onClick={() => setOpen((v) => !v)}
        className="px-2 py-0.5 rounded text-[10px] uppercase tracking-wider border border-[var(--color-border)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]"
      >
        {open ? "Hide" : "Explain"}
      </button>
      {open && (
        <div className="absolute z-30 right-0 mt-1 w-[420px] max-w-[90vw] p-3 rounded-md border border-[var(--color-border)] bg-[var(--color-panel)] shadow-xl text-xs">
          <div className="flex items-center justify-between mb-2">
            <div className="font-semibold">
              Post-mortem · {symbol}
              {entryDate && (
                <span className="text-[var(--color-muted)] ml-1">{entryDate}</span>
              )}
            </div>
            <button
              onClick={() => setOpen(false)}
              className="text-[var(--color-muted)] hover:text-[var(--color-text)] text-sm leading-none"
              aria-label="Close"
            >
              ×
            </button>
          </div>
          {state.kind === "loading" && (
            <div className="text-[var(--color-muted)]">Analyzing trade…</div>
          )}
          {state.kind === "error" && (
            <div className="text-[var(--color-down)]">{state.message}</div>
          )}
          {state.kind === "ready" && (
            <div
              className="prose-ai"
              dangerouslySetInnerHTML={{
                __html: marked.parse(state.text, { async: false, gfm: true }) as string,
              }}
            />
          )}
        </div>
      )}
    </div>
  );
}
