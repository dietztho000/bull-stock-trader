import path from "node:path";
import fs from "node:fs/promises";

const ROOT = path.resolve(process.cwd(), "..");
export const MEMORY_DIR = path.join(ROOT, "memory");
export const SCRIPTS_DIR = path.join(ROOT, "scripts");
export const BOT_ROOT = ROOT;

export async function readMemory(file: string): Promise<string> {
  const p = path.join(MEMORY_DIR, file);
  try {
    return await fs.readFile(p, "utf8");
  } catch {
    return "";
  }
}

export const MEMORY_FILES = [
  "BENCHMARK.md",
  "TRADE-LOG.md",
  "SECTOR-LEDGER.md",
  "SECTOR-MAP.md",
  "RESEARCH-LOG.md",
  "WEEKLY-REVIEW.md",
  "TRADING-STRATEGY.md",
  "RUN-LOG.jsonl",
  "PERPLEXITY-LOG.md",
] as const;
