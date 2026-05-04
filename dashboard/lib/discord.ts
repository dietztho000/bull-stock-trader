import { spawn } from "node:child_process";
import path from "node:path";
import { BOT_ROOT } from "./memoryPath";
import { discordEnvFromSettings, loadSettings } from "./settings";

export type DiscordCategory =
  | "research"
  | "fill"
  | "midday"
  | "stops"
  | "eod"
  | "weekly"
  | "error"
  | "auth-canary"
  | "alert";

export type DiscordSendResult = {
  ok: boolean;
  delivery: "webhook" | "fallback-file" | "ntfy-only";
  output: string;
  stderr: string;
};

const FALLBACK_MARKER = "[discord fallback]";
const NTFY_ONLY_MARKER = "[alert -> ntfy:";

export async function sendDiscord(
  category: DiscordCategory,
  message: string,
  opts: {
    /** When set, looks up the bot's per-bot webhook override (audit F10)
     *  and uses it instead of the global webhook for this send. Falls
     *  back to the global webhook if the bot doesn't have an override or
     *  isn't registered. */
    botId?: string;
  } = {}
): Promise<DiscordSendResult> {
  if (!message.trim()) {
    throw new Error("sendDiscord: message is empty");
  }
  const script = path.join(BOT_ROOT, "scripts", "discord.sh");
  const settings = await loadSettings();
  const baseEnv = discordEnvFromSettings(settings);
  // Per-bot override: only the primary `webhookUrl` is overridden today —
  // a bot's research-feed override would need its own field; keeping the
  // surface tight per the audit's "additive, fully back-compat" framing.
  if (opts.botId) {
    const bot = settings.bots.find((b) => b.id === opts.botId);
    if (bot?.discordWebhookUrl) {
      baseEnv.DISCORD_WEBHOOK_URL = bot.discordWebhookUrl;
    }
  }
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    ...baseEnv,
  };

  return new Promise((resolve, reject) => {
    const proc = spawn("bash", [script, `--type=${category}`, message], {
      cwd: BOT_ROOT,
      env,
    });
    let stdout = "";
    let stderr = "";
    proc.stdout.on("data", (d) => (stdout += d.toString()));
    proc.stderr.on("data", (d) => (stderr += d.toString()));
    proc.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`discord.sh exited ${code}: ${stderr.trim().slice(0, 240)}`));
        return;
      }
      let delivery: DiscordSendResult["delivery"] = "webhook";
      if (stdout.includes(FALLBACK_MARKER)) delivery = "fallback-file";
      else if (stdout.includes(NTFY_ONLY_MARKER)) delivery = "ntfy-only";
      resolve({ ok: true, delivery, output: stdout, stderr });
    });
    proc.on("error", reject);
  });
}
