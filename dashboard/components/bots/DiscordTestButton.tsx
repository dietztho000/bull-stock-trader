"use client";

import { useState } from "react";

type TestState =
  | { kind: "idle" }
  | { kind: "sending" }
  | { kind: "ok"; delivery: string }
  | { kind: "error"; message: string };

/** Audit F7 — per-bot Discord webhook test. Posts to the existing
 *  `/api/discord/brief?test=true&bot=<id>` endpoint, which resolves the
 *  bot's context and routes the test message through its per-bot webhook
 *  override (or the global fallback). Surfaces the delivery channel inline
 *  so the user can verify routing without leaving the bots page. */
export function DiscordTestButton({ botId }: { botId: string }) {
  const [state, setState] = useState<TestState>({ kind: "idle" });

  async function send() {
    setState({ kind: "sending" });
    try {
      const resp = await fetch(
        `/api/discord/brief?test=true&bot=${encodeURIComponent(botId)}`,
        { method: "POST" }
      );
      const body = await resp.json();
      if (!resp.ok) {
        setState({
          kind: "error",
          message: body.error ?? `HTTP ${resp.status}`,
        });
        return;
      }
      setState({ kind: "ok", delivery: body.delivery ?? "ok" });
      setTimeout(() => setState({ kind: "idle" }), 3500);
    } catch (err) {
      setState({
        kind: "error",
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  let label = "Test webhook";
  let className = "text-[11px] text-[var(--color-muted)] hover:text-[var(--color-text)]";
  let title: string | undefined;

  if (state.kind === "sending") {
    label = "Sending…";
  } else if (state.kind === "ok") {
    if (state.delivery === "webhook") {
      label = "✓ Delivered";
      className = "text-[11px] text-[var(--color-up)]";
    } else if (state.delivery === "fallback-file") {
      label = "⚠ Wrote to file";
      title = "Webhook not set — message wrote to DAILY-SUMMARY.md";
      className = "text-[11px] text-[var(--color-warn)]";
    } else if (state.delivery === "suppressed") {
      label = "✓ Sent (filtered)";
      title = "Test bypassed your suppression filters";
      className = "text-[11px] text-[var(--color-up)]";
    } else {
      label = `✓ ${state.delivery}`;
      className = "text-[11px] text-[var(--color-up)]";
    }
  } else if (state.kind === "error") {
    label = "✗ Failed";
    title = state.message;
    className = "text-[11px] text-[var(--color-down)]";
  }

  return (
    <button
      type="button"
      onClick={send}
      disabled={state.kind === "sending"}
      title={title}
      className={`${className} disabled:opacity-50`}
    >
      {label}
    </button>
  );
}
