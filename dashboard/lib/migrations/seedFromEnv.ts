import "server-only";
import fs from "node:fs/promises";
import path from "node:path";
import { BOT_ROOT } from "@/lib/memoryPath";
import { encryptCredential } from "@/lib/accountVault";
import { addAccount, addBot, listAccounts, listBots } from "@/lib/settings";

/** One-shot migration: if the registry is empty but `.env` already has
 *  Alpaca credentials, create one Account record per configured cred set
 *  and one Bot per Account.
 *
 *  Audit A1: bot ids are namespaced `legacy-live` / `legacy-paper` so the
 *  unprefixed `live` / `paper` slugs are free for users to claim on their
 *  own bots. The `memoryAlias` field points the dashboard at the existing
 *  `memory/live/default/` and `memory/paper/default/` trees the bot's
 *  routines write to (the bot's `BOT_MODE=live` cron writes there based
 *  on env, regardless of dashboard naming). Old `?bot=live` URL bookmarks
 *  continue to resolve via the shim in `resolveBotId`.
 *
 *  Idempotent: safe to call on every app boot. Returns true if it did any
 *  work, false if the registry was already populated. */
export async function seedRegistryFromEnvIfEmpty(): Promise<boolean> {
  const accounts = await listAccounts();
  if (accounts.length > 0) return false;

  const env = await readDotenv();
  let didWork = false;

  if (env.ALPACA_API_KEY && env.ALPACA_SECRET_KEY) {
    await addAccount({
      id: "legacy-live-main",
      label: "Live (env)",
      mode: "live",
      endpoint: env.ALPACA_ENDPOINT ?? "https://api.alpaca.markets/v2",
      apiKeyEnc: encryptCredential(env.ALPACA_API_KEY),
      secretKeyEnc: encryptCredential(env.ALPACA_SECRET_KEY),
      createdAt: new Date().toISOString(),
    });
    const existingBots = await listBots();
    if (!existingBots.some((b) => b.id === "legacy-live")) {
      await addBot({
        id: "legacy-live",
        name: "Live",
        accountId: "legacy-live-main",
        allocation: null,
        strategySlug: "default",
        memoryAlias: "live",
        enabled: true,
        createdAt: new Date().toISOString(),
      });
    }
    didWork = true;
  }

  if (env.ALPACA_PAPER_API_KEY && env.ALPACA_PAPER_SECRET_KEY) {
    await addAccount({
      id: "legacy-paper-main",
      label: "Paper (env)",
      mode: "paper",
      endpoint: env.ALPACA_PAPER_ENDPOINT ?? "https://paper-api.alpaca.markets/v2",
      apiKeyEnc: encryptCredential(env.ALPACA_PAPER_API_KEY),
      secretKeyEnc: encryptCredential(env.ALPACA_PAPER_SECRET_KEY),
      createdAt: new Date().toISOString(),
    });
    const existingBots = await listBots();
    if (!existingBots.some((b) => b.id === "legacy-paper")) {
      await addBot({
        id: "legacy-paper",
        name: "Paper",
        accountId: "legacy-paper-main",
        allocation: null,
        strategySlug: "default",
        memoryAlias: "paper",
        enabled: true,
        createdAt: new Date().toISOString(),
      });
    }
    didWork = true;
  }

  return didWork;
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
    // process.env wins so a runtime override beats the file
    return { ...out, ...(process.env as Record<string, string>) };
  } catch {
    return { ...(process.env as Record<string, string>) };
  }
}
