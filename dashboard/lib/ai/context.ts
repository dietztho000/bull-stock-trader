import Anthropic from "@anthropic-ai/sdk";
import { readMemory, type MemoryCtx } from "../memoryPath";

const VOICE_RULES = `Voice rules (MUST follow):
- Ultra concise. Short bullets. No preamble. No "Sure!", no "Here is...".
- Cite trade dates (e.g. 2026-04-22) and rule numbers (e.g. rule #17) when relevant.
- Never invent rules, tickers, or prices not in the context provided.
- If memory cannot answer the question, say so plainly. Do not speculate.`;

export type BotContext = {
  system: Anthropic.TextBlockParam[];
  strategyText: string;
  tradeLogText: string;
  sectorLedgerText: string;
  benchmarkText: string;
  researchLogText: string;
};

export async function buildBotContext(ctx: MemoryCtx): Promise<BotContext> {
  const [
    strategyText,
    tradeLogText,
    sectorLedgerText,
    benchmarkText,
    researchLogText,
  ] = await Promise.all([
    readMemory("TRADING-STRATEGY.md", ctx),
    readMemory("TRADE-LOG.md", ctx),
    readMemory("SECTOR-LEDGER.md", ctx),
    readMemory("BENCHMARK.md", ctx),
    readMemory("RESEARCH-LOG.md", ctx),
  ]);

  const system: Anthropic.TextBlockParam[] = [
    {
      type: "text",
      text: `You are an analyst assistant for the Bull Stock Trader bot — a live ~$10K Alpaca account managed by Claude Code routines. You answer the human operator's questions about the bot's state, trades, and rule adherence using the memory files below.\n\n${VOICE_RULES}`,
    },
    {
      type: "text",
      text: `# TRADING-STRATEGY.md (rulebook — never violate)\n\n${strategyText}`,
    },
    {
      type: "text",
      text: `# TRADE-LOG.md (entries, EOD snapshots, annotations)\n\n${tradeLogText}`,
    },
    {
      type: "text",
      text: `# SECTOR-LEDGER.md (closed trades, sector streaks)\n\n${sectorLedgerText}`,
    },
    {
      type: "text",
      text: `# BENCHMARK.md (daily equity vs SPY)\n\n${benchmarkText}`,
      cache_control: { type: "ephemeral" },
    },
  ];

  return {
    system,
    strategyText,
    tradeLogText,
    sectorLedgerText,
    benchmarkText,
    researchLogText,
  };
}
