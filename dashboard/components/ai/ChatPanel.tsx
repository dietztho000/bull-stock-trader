"use client";

import { useEffect, useRef, useState } from "react";
import { marked } from "marked";
import { useTradingAccountOptional } from "@/lib/tradingAccountContext";

type Turn = { role: "user" | "assistant"; content: string };

const STARTER_PROMPTS = [
  "Why did we sell my last loss?",
  "Are we close to the sector cap?",
  "What rule fired most this week?",
  "Summarize today's research.",
];

export function ChatPanel({ onClose }: { onClose: () => void }) {
  const ctx = useTradingAccountOptional();
  const botId = ctx?.botId;
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [turns]);

  async function send(prompt: string) {
    if (!prompt.trim() || streaming) return;
    setError(null);
    const next: Turn[] = [...turns, { role: "user", content: prompt }];
    setTurns(next);
    setInput("");
    setStreaming(true);
    setTurns((t) => [...t, { role: "assistant", content: "" }]);

    try {
      // Scope chat to the active bot — without it the route falls back to
      // BOT_MODE env, so a question asked in a paper-bot tab silently
      // answers about the live bot's memory (audit C5).
      const qs = botId ? `?bot=${encodeURIComponent(botId)}` : "";
      const resp = await fetch(`/api/ai/chat${qs}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next }),
      });
      if (!resp.ok || !resp.body) {
        const msg = await resp.text();
        throw new Error(msg || `HTTP ${resp.status}`);
      }
      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const evt = JSON.parse(line.slice(6));
            if (evt.delta) {
              setTurns((t) => {
                const copy = [...t];
                copy[copy.length - 1] = {
                  role: "assistant",
                  content: copy[copy.length - 1].content + evt.delta,
                };
                return copy;
              });
            } else if (evt.error) {
              throw new Error(evt.error);
            }
          } catch (err) {
            if (err instanceof SyntaxError) continue;
            throw err;
          }
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "request failed";
      setError(msg);
      setTurns((t) => t.slice(0, -1));
    } finally {
      setStreaming(false);
    }
  }

  return (
    <div className="fixed bottom-0 right-0 top-0 w-full sm:w-[460px] z-50 bg-[var(--color-panel)] border-l border-[var(--color-border)] shadow-2xl flex flex-col">
      <header className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border)]">
        <div>
          <div className="text-sm font-semibold">Ask the bot</div>
          <div className="text-[11px] text-[var(--color-muted)]">
            Reads memory files · Sonnet 4.6
          </div>
        </div>
        <button
          onClick={onClose}
          className="text-[var(--color-muted)] hover:text-[var(--color-text)] text-lg leading-none px-2"
          aria-label="Close chat"
        >
          ×
        </button>
      </header>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3 text-sm">
        {turns.length === 0 && (
          <div className="space-y-2">
            <div className="text-xs text-[var(--color-muted)]">Try one of these:</div>
            {STARTER_PROMPTS.map((p) => (
              <button
                key={p}
                onClick={() => send(p)}
                className="block w-full text-left px-3 py-2 rounded border border-[var(--color-border)] bg-[var(--color-panel-2)] hover:border-[var(--color-accent)] text-xs"
              >
                {p}
              </button>
            ))}
          </div>
        )}
        {turns.map((t, i) => (
          <div
            key={i}
            className={
              t.role === "user"
                ? "ml-6 px-3 py-2 rounded bg-[var(--color-panel-2)] border border-[var(--color-border)]"
                : "mr-6 px-3 py-2 rounded border border-[var(--color-border)]/60"
            }
          >
            {t.role === "assistant" ? (
              <div
                className="prose-ai"
                dangerouslySetInnerHTML={{
                  __html: marked.parse(t.content || "…", { async: false, gfm: true }) as string,
                }}
              />
            ) : (
              <div className="whitespace-pre-wrap">{t.content}</div>
            )}
          </div>
        ))}
        {error && (
          <div className="text-xs text-[var(--color-down)] px-3 py-2 border border-red-500/30 rounded bg-red-500/10">
            {error}
          </div>
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="p-3 border-t border-[var(--color-border)]"
      >
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send(input);
            }
          }}
          rows={2}
          placeholder="Ask about positions, rules, trades…"
          disabled={streaming}
          className="w-full px-3 py-2 rounded bg-[var(--color-panel-2)] border border-[var(--color-border)] text-sm resize-none focus:outline-none focus:border-[var(--color-accent)]"
        />
        <div className="flex items-center justify-between mt-2">
          <div className="text-[10px] text-[var(--color-muted)]">
            Enter to send · Shift+Enter for newline
          </div>
          <button
            type="submit"
            disabled={streaming || !input.trim()}
            className="px-3 py-1 rounded bg-[var(--color-accent)] text-black text-xs font-medium disabled:opacity-40"
          >
            {streaming ? "Thinking…" : "Send"}
          </button>
        </div>
      </form>
    </div>
  );
}
