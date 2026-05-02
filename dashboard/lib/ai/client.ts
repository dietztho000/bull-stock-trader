import Anthropic from "@anthropic-ai/sdk";

let cached: Anthropic | null = null;

export function getAnthropic(): Anthropic {
  if (!cached) {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error(
        "ANTHROPIC_API_KEY missing — add it to dashboard/.env.local"
      );
    }
    cached = new Anthropic();
  }
  return cached;
}

export const MODELS = {
  chat: "claude-sonnet-4-6",
  drawdown: "claude-sonnet-4-6",
  postMortem: "claude-opus-4-7",
} as const;
