"use client";

import { useState } from "react";
import type { ParsedStrategy } from "@/lib/ai/strategyParser";

const PARSE_URL = "/api/strategies/parse";

const inputClass =
  "w-full rounded-lg bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.08)] px-3 py-2 text-sm focus:outline-none focus:border-[var(--color-accent)]";

const PLACEHOLDER = `Paste a description like:

"Build a mean-reversion strategy on S&P 500 components with 1h RSI<30 entries.
Max 2 day hold. -4% stop. Take profit half at +6%, trail rest at 3%. No earnings within 2 days. Max 5 open positions, day breaker -2%."

…or use one of the example prompts below.`;

const EXAMPLES: { label: string; prompt: string }[] = [
  {
    label: "Mean reversion (RSI)",
    prompt:
      "Mean-reversion on S&P 500 components, 1h timeframe. Buy when 14-period RSI crosses up through 30 from below, only above the 200-day MA. -4% stop-limit, hard exit at end of day 2 if not green. Take half off at +6%, trail the rest at 3%. Max 5 open positions, day P&L breaker at -2%, no entries within 2 trading days of earnings.",
  },
  {
    label: "Momentum + MA crossover",
    prompt:
      "Trend-following momentum strategy. Daily timeframe. Buy when 10-day EMA crosses above 50-day EMA AND ADX(14) > 25. Conviction-weighted sizing 7→10%, 8→13%, 9→17%, 10→20%. -7% fixed stop at entry, promote to 10% trail once green, tighten to 7% at +15% and 5% at +25%. Take half off at +25%. Sector cap of 3, max 6 positions, week breaker at -4%.",
  },
  {
    label: "Breakout (ATR)",
    prompt:
      "Volatility breakout strategy on liquid mid-caps ($1B-$50B mkt cap). Buy when price breaks above 20-day high with volume > 1.5× 20-day avg. Position-size by ATR: target 1% of equity per 1× ATR(14) of risk, 18% absolute ceiling. Hard stop at 2× ATR below entry. Trail at 3× ATR once at +1R. Earnings gate 3 days. Max 4 concurrent breakouts. Day breaker -3%.",
  },
  {
    label: "Defensive dividend tilt",
    prompt:
      "Conservative dividend tilt for capital preservation. Universe: S&P 500 components with dividend yield > 2.5% and payout ratio < 75%. Daily candles. Buy on pullbacks to 50-day MA when 14-day RSI is below 45. Equal-weight 8% positions, 60-70% deployed target, max 8 holdings. -5% stop, no trailing — let dividends compound. No new entries during day P&L < -1%. Earnings gate 2 days.",
  },
];

export function AIStrategyBuilder({
  onApply,
  disabled,
}: {
  /** Receives the LLM's parsed strategy. The parent merges these into the
   *  form fields and decides whether to collapse the advanced section. */
  onApply: (s: ParsedStrategy) => void;
  /** Disable while the surrounding form is busy (e.g. saving). */
  disabled?: boolean;
}) {
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setError(null);
    if (prompt.trim().length < 20) {
      setError("Describe the strategy in at least a sentence.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(PARSE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: prompt.trim() }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        strategy?: ParsedStrategy;
        error?: string;
      };
      if (!res.ok || !body.strategy) {
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      onApply(body.strategy);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      aria-label="AI Strategy Builder"
      className="rounded-xl border border-[rgba(255,255,255,0.08)] bg-[rgba(123,97,255,0.06)] p-3 space-y-2"
    >
      <header className="flex items-center justify-between gap-2">
        <div>
          <div className="text-xs font-semibold flex items-center gap-1.5">
            <SparkleIcon />
            AI Strategy Builder
          </div>
          <div className="text-[10px] text-[var(--color-muted)] mt-0.5">
            Describe the strategy in plain English — Claude fills the form for you.
          </div>
        </div>
      </header>

      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder={PLACEHOLDER}
        rows={6}
        disabled={busy || disabled}
        maxLength={8000}
        className={`${inputClass} font-mono text-[11px] leading-relaxed resize-y disabled:opacity-50`}
      />

      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-[10px] text-[var(--color-muted)] mr-1">Try:</span>
        {EXAMPLES.map((ex) => (
          <button
            key={ex.label}
            type="button"
            onClick={() => setPrompt(ex.prompt)}
            disabled={busy || disabled}
            className="glass rounded-full px-2 py-0.5 text-[10px] hover:opacity-90 disabled:opacity-40"
          >
            {ex.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="text-[11px] text-[var(--color-down)] break-all">
          {error}
        </div>
      )}

      <div className="flex items-center justify-between gap-2 pt-1">
        <span className="text-[10px] text-[var(--color-muted)]">
          {prompt.length}/8000
        </span>
        <button
          type="button"
          onClick={submit}
          disabled={busy || disabled || prompt.trim().length < 20}
          className="glass glass-tint-accent rounded-full px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
        >
          {busy ? (
            <span className="inline-flex items-center gap-1.5">
              <Spinner /> Parsing…
            </span>
          ) : (
            <>Apply AI Prompt → Auto-Fill Strategy</>
          )}
        </button>
      </div>
    </section>
  );
}

function SparkleIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      width="12"
      height="12"
      aria-hidden
      className="text-[var(--color-accent)]"
    >
      <path
        fill="currentColor"
        d="M8 0l1.6 4.4L14 6l-4.4 1.6L8 12 6.4 7.6 2 6l4.4-1.6L8 0zm5 9l.8 2.2L16 12l-2.2.8L13 15l-.8-2.2L10 12l2.2-.8L13 9zM3 10l.6 1.6L5.2 12l-1.6.4L3 14l-.6-1.6L.8 12l1.6-.4L3 10z"
      />
    </svg>
  );
}

function Spinner() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 16 16"
      aria-hidden
      className="animate-spin"
    >
      <circle
        cx="8"
        cy="8"
        r="6"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeDasharray="28"
        strokeDashoffset="20"
        strokeLinecap="round"
      />
    </svg>
  );
}
