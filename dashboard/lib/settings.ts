import path from "node:path";
import fs from "node:fs/promises";
import { z } from "zod";
import { MEMORY_DIR } from "./memoryPath";

const FILE = path.join(MEMORY_DIR, "dashboard-settings.json");

const webhookUrlSchema = z
  .string()
  .url()
  .refine(
    (v) => v.startsWith("https://discord.com/api/webhooks/") || v.startsWith("https://discordapp.com/api/webhooks/"),
    "Discord webhook URLs must start with https://discord.com/api/webhooks/"
  );

const optionalWebhook = webhookUrlSchema.nullable().optional();

const settingsSchema = z.object({
  discord: z
    .object({
      webhookUrl: optionalWebhook,
      webhookUrlResearch: optionalWebhook,
      ntfyTopic: z.string().min(1).max(80).nullable().optional(),
    })
    .default({}),
});

export type DashboardSettings = z.infer<typeof settingsSchema>;

const EMPTY: DashboardSettings = { discord: {} };

export async function loadSettings(): Promise<DashboardSettings> {
  try {
    const raw = await fs.readFile(FILE, "utf8");
    const parsed = JSON.parse(raw);
    const result = settingsSchema.safeParse(parsed);
    if (!result.success) return EMPTY;
    return result.data;
  } catch {
    return EMPTY;
  }
}

export const settingsPatchSchema = z.object({
  discord: z
    .object({
      webhookUrl: z.union([webhookUrlSchema, z.literal(""), z.null()]).optional(),
      webhookUrlResearch: z.union([webhookUrlSchema, z.literal(""), z.null()]).optional(),
      ntfyTopic: z.union([z.string().min(1).max(80), z.literal(""), z.null()]).optional(),
    })
    .optional(),
});

export type SettingsPatch = z.infer<typeof settingsPatchSchema>;

export async function saveSettings(patch: SettingsPatch): Promise<DashboardSettings> {
  const current = await loadSettings();
  const next: DashboardSettings = {
    discord: { ...current.discord },
  };
  if (patch.discord) {
    for (const key of ["webhookUrl", "webhookUrlResearch", "ntfyTopic"] as const) {
      if (!(key in patch.discord)) continue;
      const v = patch.discord[key];
      if (v === "" || v === null || v === undefined) {
        delete next.discord[key];
      } else {
        next.discord[key] = v;
      }
    }
  }

  await fs.mkdir(path.dirname(FILE), { recursive: true });
  await fs.writeFile(FILE, JSON.stringify(next, null, 2) + "\n", "utf8");
  return next;
}

export type WebhookSource = "settings" | "env" | "none";

export type RedactedField = {
  isSet: boolean;
  source: WebhookSource;
  hint: string | null;
};

export type RedactedSettings = {
  discord: {
    webhookUrl: RedactedField;
    webhookUrlResearch: RedactedField;
    ntfyTopic: RedactedField;
  };
};

function hintFor(value: string | undefined | null, kind: "webhook" | "topic"): string | null {
  if (!value) return null;
  if (kind === "webhook") {
    const m = value.match(/\/webhooks\/(\d{6,})\/([A-Za-z0-9_-]+)/);
    if (!m) return "set";
    const idTail = m[1].slice(-4);
    const tokTail = m[2].slice(-4);
    return `…${idTail}/…${tokTail}`;
  }
  return value.length <= 6 ? value : `${value.slice(0, 4)}…${value.slice(-2)}`;
}

function fieldFor(
  settingsValue: string | undefined | null,
  envValue: string | undefined | null,
  kind: "webhook" | "topic"
): RedactedField {
  if (settingsValue) {
    return { isSet: true, source: "settings", hint: hintFor(settingsValue, kind) };
  }
  if (envValue) {
    return { isSet: true, source: "env", hint: hintFor(envValue, kind) };
  }
  return { isSet: false, source: "none", hint: null };
}

export async function loadRedactedSettings(): Promise<RedactedSettings> {
  const s = await loadSettings();
  return {
    discord: {
      webhookUrl: fieldFor(s.discord.webhookUrl, process.env.DISCORD_WEBHOOK_URL, "webhook"),
      webhookUrlResearch: fieldFor(
        s.discord.webhookUrlResearch,
        process.env.DISCORD_WEBHOOK_URL_RESEARCH,
        "webhook"
      ),
      ntfyTopic: fieldFor(s.discord.ntfyTopic, process.env.NTFY_TOPIC, "topic"),
    },
  };
}

/** Builds the env vars to inject into a child process so scripts/discord.sh
 * sees the user's settings overrides ahead of .env / .env.local values. */
export function discordEnvFromSettings(s: DashboardSettings): Record<string, string> {
  const out: Record<string, string> = {};
  if (s.discord.webhookUrl) out.DISCORD_WEBHOOK_URL = s.discord.webhookUrl;
  if (s.discord.webhookUrlResearch) out.DISCORD_WEBHOOK_URL_RESEARCH = s.discord.webhookUrlResearch;
  if (s.discord.ntfyTopic) out.NTFY_TOPIC = s.discord.ntfyTopic;
  return out;
}
