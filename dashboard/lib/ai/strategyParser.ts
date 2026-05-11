import type Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { getAnthropic, MODELS } from "./client";
import { logCacheUsage } from "./promptCache";

const slugRe = /^[a-z0-9][a-z0-9-]*$/;
const keyRe = /^[A-Z][A-Z0-9_]*$/;

const paramKeySchema = z.string().min(1).max(40).regex(keyRe);

/** Structural mirror of `StrategyParam` from settings.schema.ts. Kept here to
 *  avoid pulling the full settings dep graph into the prompt module — same
 *  shape, same constraints. The route handler validates the API contract;
 *  this schema validates the LLM's output before it leaves the server. */
const paramSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("number"),
    key: paramKeySchema,
    label: z.string().min(1).max(60),
    value: z.number(),
    min: z.number().optional(),
    max: z.number().optional(),
    step: z.number().positive().optional(),
    unit: z.string().max(8).optional(),
  }),
  z.object({
    kind: z.literal("percent"),
    key: paramKeySchema,
    label: z.string().min(1).max(60),
    value: z.number(),
    min: z.number(),
    max: z.number(),
  }),
  z.object({
    kind: z.literal("enum"),
    key: paramKeySchema,
    label: z.string().min(1).max(60),
    value: z.string().min(1),
    options: z.array(z.string().min(1)).min(2).max(20),
  }),
  z.object({
    kind: z.literal("table"),
    key: paramKeySchema,
    label: z.string().min(1).max(60),
    rows: z
      .array(
        z.object({
          k: z.union([z.string(), z.number()]),
          v: z.union([z.string(), z.number()]),
        })
      )
      .min(1)
      .max(50),
  }),
]);

export const parsedStrategySchema = z.object({
  slug: z.string().regex(slugRe).max(40).optional(),
  name: z.string().min(1).max(60),
  description: z.string().max(500).default(""),
  ruleBookTemplate: z.string().default(""),
  params: z.array(paramSchema).max(40).default([]),
});

export type ParsedStrategy = z.infer<typeof parsedStrategySchema>;

const SYSTEM_PROMPT = `You convert a trader's natural-language strategy description into a structured StrategyConfig JSON object for the Bull Stock Trader dashboard.

The dashboard runs an autonomous Alpaca bot. Strategies become typed knobs that cloud routines read at runtime as STRATEGY_<KEY> env vars.

# Output contract

Return EXACTLY one JSON object inside a fenced \`\`\`json block. No prose before or after.

\`\`\`json
{
  "slug": "kebab-case-id",
  "name": "Human-readable name (≤60 chars)",
  "description": "One-sentence summary (≤500 chars).",
  "ruleBookTemplate": "Markdown rule book — see below.",
  "params": [ /* StrategyParam[] — see schema */ ]
}
\`\`\`

# StrategyParam discriminated union

Every param has \`kind\`, \`key\` (SCREAMING_SNAKE_CASE, ≤40 chars), and \`label\` (≤60 chars). Choose the kind that fits:

- \`{ kind: "number", key, label, value, min?, max?, step?, unit? }\` — counts, integer thresholds, lookback windows
- \`{ kind: "percent", key, label, value, min, max }\` — anything expressed as a percent. \`min\` and \`max\` are REQUIRED. \`value\` must be in [min, max]. Negative numbers are fine for losses (e.g. value: -2, min: -20, max: 0)
- \`{ kind: "enum", key, label, value, options }\` — a fixed list (≥2 options). \`value\` must appear in \`options\`
- \`{ kind: "table", key, label, rows: [{k, v}, ...] }\` — for mappings like score → size. \`k\` and \`v\` may be string or number. ≥1 row, ≤50 rows

Param key naming: prefer the proven default-strategy keys when applicable so existing routines pick them up unchanged:

  SECTOR_CAP, MAX_OPEN_POSITIONS, DAY_BREAKER_PCT, WEEK_BREAKER_PCT,
  EARNINGS_GATE_DAYS, ENTRY_SCORE_MIN, TARGET_DEPLOYED_LOW_PCT,
  TARGET_DEPLOYED_HIGH_PCT, CONVICTION_TABLE, STOP_TRIGGER_PCT,
  STOP_LIMIT_PCT, TRAIL_PROMOTION_PCT, TRAIL_INITIAL_PCT,
  TRAIL_TIGHTEN_15_TRIGGER_PCT, TRAIL_TIGHTEN_15_PCT,
  TRAIL_TIGHTEN_20_TRIGGER_PCT, TRAIL_TIGHTEN_20_PCT,
  TAKE_PROFIT_LADDER_PCT

For strategy-specific knobs (RSI threshold, MA window, ATR multiple, timeframe, etc.) invent a clear SCREAMING_SNAKE_CASE key.

# Rule book template

A markdown body that will seed \`memory/<bot>/<slug>/TRADING-STRATEGY.md\`. Match the existing house style: numbered hard rules, terse. Include sections for:

- Mission / Edge thesis (1-3 sentences)
- Universe & timeframes
- Entry rules (numbered)
- Position sizing
- Risk management (stops, drawdown circuit breakers, earnings gate)
- Exit rules (take-profit, trail tightening)
- Hard NOs

# Example output

User input: "Build a mean-reversion strategy on SPY components, 1h timeframe, RSI<30 entries with 2-day max hold and 4% stop."

\`\`\`json
{
  "slug": "mean-reversion-1h",
  "name": "Mean Reversion 1H",
  "description": "Buy oversold S&P 500 components on 1h RSI<30, fixed -4% stop, 2-day max hold.",
  "ruleBookTemplate": "# Mean Reversion 1H — Rule Book\\n\\n## Mission\\nBuy short-term oversold large-caps; let mean reversion close the gap inside 2 sessions.\\n\\n## Universe & timeframe\\n- S&P 500 components only.\\n- 1h candles for signal; daily for filters.\\n\\n## Entry rules\\n1. 1h RSI(14) crosses up through 30 from below.\\n2. Above 200-day MA on daily.\\n3. No earnings within 2 trading days.\\n4. Entry score >= 7/10 (catalyst, distance-from-MA, R:R, sector tape).\\n\\n## Position sizing\\n- Conviction-weighted (see CONVICTION_TABLE param).\\n- 20% absolute ceiling per position.\\n\\n## Risk\\n- Fixed -4% stop-limit at entry.\\n- Day P&L circuit breaker: no new entries below -2%.\\n- Max 5 open positions.\\n\\n## Exits\\n- Hard time stop: close any position not green by end of day 2.\\n- Take-profit ladder: sell half at +6%, trail rest at 3%.\\n\\n## NO\\n- No options. No leverage. No averaging down.\\n",
  "params": [
    { "kind": "number", "key": "RSI_PERIOD", "label": "RSI lookback (1h bars)", "value": 14, "min": 2, "max": 50, "step": 1 },
    { "kind": "percent", "key": "RSI_OVERSOLD", "label": "RSI oversold threshold", "value": 30, "min": 0, "max": 100 },
    { "kind": "number", "key": "MAX_HOLD_DAYS", "label": "Max holding period (days)", "value": 2, "min": 1, "max": 30, "step": 1 },
    { "kind": "percent", "key": "STOP_TRIGGER_PCT", "label": "Entry stop trigger", "value": -4, "min": -20, "max": 0 },
    { "kind": "percent", "key": "STOP_LIMIT_PCT", "label": "Stop-limit slippage floor", "value": -5, "min": -25, "max": 0 },
    { "kind": "number", "key": "MAX_OPEN_POSITIONS", "label": "Max open positions", "value": 5, "min": 1, "max": 20, "step": 1 },
    { "kind": "percent", "key": "DAY_BREAKER_PCT", "label": "Day P&L circuit breaker", "value": -2, "min": -20, "max": 0 },
    { "kind": "percent", "key": "TAKE_PROFIT_LADDER_PCT", "label": "Take-profit ladder trigger", "value": 6, "min": 0, "max": 100 },
    { "kind": "enum", "key": "TIMEFRAME", "label": "Signal timeframe", "value": "1h", "options": ["15m", "30m", "1h", "1d"] },
    { "kind": "table", "key": "CONVICTION_TABLE", "label": "Entry score → size %", "rows": [{"k":7,"v":10},{"k":8,"v":13},{"k":9,"v":16},{"k":10,"v":20}] }
  ]
}
\`\`\`

# Rules

- Output ONLY the fenced \`\`\`json block. No commentary.
- Every percent param MUST have min and max. value MUST be inside [min, max].
- Every enum param MUST have ≥2 options and value MUST be one of them.
- If the user references a knob without a number, pick a sensible default and put it in the value.
- If the user gives no slug, derive one from the name (kebab-case, ≤40 chars).
- Keep params under 25 unless the user explicitly listed more.`;

/** Strip the first \`\`\`json ... \`\`\` (or plain \`\`\` ... \`\`\`) fence. Falls
 *  back to the trimmed input so a model that returned bare JSON still
 *  parses. */
function extractJson(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) return fenced[1].trim();
  return text.trim();
}

export type ParseStrategyResult =
  | { ok: true; strategy: ParsedStrategy }
  | { ok: false; error: string; raw?: string };

export async function parseStrategyPrompt(
  userPrompt: string,
  opts: { existingSlugs?: string[] } = {}
): Promise<ParseStrategyResult> {
  const trimmed = userPrompt.trim();
  if (trimmed.length < 20) {
    return { ok: false, error: "Prompt is too short — describe the strategy in at least a sentence." };
  }
  if (trimmed.length > 8000) {
    return { ok: false, error: "Prompt is too long — keep it under 8000 characters." };
  }

  let client;
  try {
    client = getAnthropic();
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "AI client unavailable" };
  }

  const userMsg =
    (opts.existingSlugs?.length
      ? `Existing slugs already in use (avoid these): ${opts.existingSlugs.join(", ")}\n\n`
      : "") + `Strategy description:\n\n${trimmed}`;

  let response: Anthropic.Message;
  try {
    response = await client.messages.create({
      model: MODELS.chat,
      max_tokens: 3000,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userMsg }],
    });
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "LLM call failed" };
  }

  await logCacheUsage("strategy-parse", response.usage);

  const text = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();

  if (!text) {
    return { ok: false, error: "LLM returned no text." };
  }

  const json = extractJson(text);
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch (err) {
    return {
      ok: false,
      error: `LLM did not return valid JSON: ${err instanceof Error ? err.message : "parse error"}`,
      raw: text,
    };
  }

  const parsed = parsedStrategySchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: `LLM output failed schema validation: ${parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`,
      raw: text,
    };
  }

  return { ok: true, strategy: parsed.data };
}
