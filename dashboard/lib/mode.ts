import fs from "node:fs/promises";
import path from "node:path";
import { runAlpaca, type AlpacaMode } from "./alpaca";
import { BOT_ROOT } from "./memoryPath";

export type Mode = "paper" | "live" | "unknown";
export type ModeSource = "account-number" | "bot-mode-env" | "endpoint" | "unknown";

export interface ModeInfo {
  mode: Mode;
  source: ModeSource;
  endpoint: string | null;
  accountNumber: string | null;
  error: string | null;
}

export interface AccountProbe {
  target: AlpacaMode;
  configured: boolean;
  accountNumber: string | null;
  endpoint: string | null;
  error: string | null;
}

async function readDotenv(): Promise<Record<string, string>> {
  const envPath = path.join(BOT_ROOT, ".env");
  try {
    const raw = await fs.readFile(envPath, "utf8");
    const out: Record<string, string> = {};
    for (const rawLine of raw.split("\n")) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) continue;
      const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
      if (!m) continue;
      const [, key, val] = m;
      out[key] = val.replace(/^["']|["']$/g, "");
    }
    return out;
  } catch {
    return {};
  }
}

export async function detectMode(): Promise<ModeInfo> {
  // Try the authoritative signal first: Alpaca account_number starts with "PA"
  // for paper accounts, otherwise it's a live account.
  try {
    const account = (await runAlpaca("account")) as { account_number?: string };
    const acct = account?.account_number ?? null;
    if (acct) {
      return {
        mode: acct.startsWith("PA") ? "paper" : "live",
        source: "account-number",
        endpoint: null,
        accountNumber: acct,
        error: null,
      };
    }
  } catch (err) {
    // Auth failed or wrapper crashed — fall through to env inspection so the
    // badge still gives the user a useful signal during an outage.
    const errMsg = err instanceof Error ? err.message : String(err);
    const env = { ...(await readDotenv()), ...process.env } as Record<string, string>;
    const botMode = (env.BOT_MODE ?? "").toLowerCase();
    if (botMode === "paper" || botMode === "live") {
      return {
        mode: botMode,
        source: "bot-mode-env",
        endpoint: env.ALPACA_ENDPOINT ?? null,
        accountNumber: null,
        error: errMsg,
      };
    }
    const ep = env.ALPACA_ENDPOINT ?? "";
    if (ep.includes("paper-api")) {
      return { mode: "paper", source: "endpoint", endpoint: ep, accountNumber: null, error: errMsg };
    }
    if (ep.includes("api.alpaca")) {
      return { mode: "live", source: "endpoint", endpoint: ep, accountNumber: null, error: errMsg };
    }
    return { mode: "unknown", source: "unknown", endpoint: ep || null, accountNumber: null, error: errMsg };
  }
  return { mode: "unknown", source: "unknown", endpoint: null, accountNumber: null, error: null };
}

export async function readBotMode(): Promise<AlpacaMode> {
  const env = { ...(await readDotenv()), ...process.env } as Record<string, string>;
  const raw = (env.BOT_MODE ?? "").toLowerCase();
  return raw === "paper" ? "paper" : "live";
}

export async function detectAccountInfo(target: AlpacaMode): Promise<AccountProbe> {
  const env = { ...(await readDotenv()), ...process.env } as Record<string, string>;
  const configured =
    target === "paper"
      ? Boolean(env.ALPACA_PAPER_API_KEY && env.ALPACA_PAPER_SECRET_KEY)
      : Boolean(env.ALPACA_API_KEY && env.ALPACA_SECRET_KEY);
  const endpoint =
    target === "paper"
      ? env.ALPACA_PAPER_ENDPOINT ?? "https://paper-api.alpaca.markets/v2"
      : env.ALPACA_ENDPOINT ?? "https://api.alpaca.markets/v2";

  if (!configured) {
    return { target, configured: false, accountNumber: null, endpoint, error: null };
  }

  try {
    const account = (await runAlpaca("account", [], { mode: target })) as {
      account_number?: string;
    };
    return {
      target,
      configured: true,
      accountNumber: account?.account_number ?? null,
      endpoint,
      error: null,
    };
  } catch (err) {
    return {
      target,
      configured: true,
      accountNumber: null,
      endpoint,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
