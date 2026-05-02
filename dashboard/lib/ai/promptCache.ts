import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const LOG_PATH = path.join(os.homedir(), ".bull-trader-ai-cache.log");

export type CacheUsage = {
  cache_creation_input_tokens?: number | null;
  cache_read_input_tokens?: number | null;
  input_tokens?: number;
  output_tokens?: number;
};

export async function logCacheUsage(label: string, usage: CacheUsage | undefined) {
  if (!usage) return;
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    label,
    cache_read: usage.cache_read_input_tokens ?? 0,
    cache_create: usage.cache_creation_input_tokens ?? 0,
    input: usage.input_tokens ?? 0,
    output: usage.output_tokens ?? 0,
  });
  try {
    await fs.appendFile(LOG_PATH, line + "\n");
  } catch {
    // best-effort — never fail a request because logging broke
  }
}
