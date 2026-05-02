import "server-only";
import path from "node:path";
import fs from "node:fs/promises";
import { MEMORY_DIR } from "./memoryPath";
import {
  DEFAULTS,
  REDACTED_MASK,
  settingsSchema,
  type DashboardSettings,
  type ExportedSettings,
  type RedactedField,
  type RedactedSettings,
  type SectionKey,
  type SettingsPatch,
  isRedactedMask,
} from "./settings.schema";

export {
  DEFAULTS,
  REDACTED_MASK,
  SECTION_KEYS,
  isRedactedMask,
  isWebhookCategory,
  isInQuietHours,
  getSuppressionReason,
  settingsPatchSchema,
  settingsSchema,
} from "./settings.schema";
export type {
  DashboardSettings,
  ExportedSettings,
  RedactedField,
  RedactedSettings,
  SectionKey,
  SettingsPatch,
  Theme,
  LandingPage,
  NumberFormatPref,
  CurrencyPref,
  AccountModeDefault,
  ChartDateRange,
  TradesFilter,
  WebhookCategory,
  WebhookSource,
  SuppressionReason,
} from "./settings.schema";

const FILE = path.join(MEMORY_DIR, "dashboard-settings.json");

const EMPTY: DashboardSettings = DEFAULTS;

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

async function writeFile(next: DashboardSettings) {
  await fs.mkdir(path.dirname(FILE), { recursive: true });
  await fs.writeFile(FILE, JSON.stringify(next, null, 2) + "\n", "utf8");
}

export async function saveSettings(patch: SettingsPatch): Promise<DashboardSettings> {
  const current = await loadSettings();
  const next: DashboardSettings = {
    discord: { ...current.discord },
    display: { ...current.display },
    live: { ...current.live },
    defaults: { ...current.defaults },
    notifications: {
      ...current.notifications,
      webhookCategoryFilters: { ...current.notifications.webhookCategoryFilters },
      quietHours: { ...current.notifications.quietHours },
    },
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

  if (patch.display) Object.assign(next.display, patch.display);
  if (patch.live) Object.assign(next.live, patch.live);
  if (patch.defaults) Object.assign(next.defaults, patch.defaults);
  if (patch.notifications) {
    if (patch.notifications.webhookCategoryFilters) {
      Object.assign(
        next.notifications.webhookCategoryFilters,
        patch.notifications.webhookCategoryFilters
      );
    }
    if (patch.notifications.quietHours) {
      Object.assign(next.notifications.quietHours, patch.notifications.quietHours);
    }
    if (patch.notifications.desktopNotificationsEnabled !== undefined) {
      next.notifications.desktopNotificationsEnabled =
        patch.notifications.desktopNotificationsEnabled;
    }
  }

  await writeFile(next);
  return next;
}

/** Reset a single section (or all) to schema defaults. */
export async function resetSection(section: SectionKey | "all"): Promise<DashboardSettings> {
  const current = await loadSettings();
  let next: DashboardSettings;
  if (section === "all") {
    next = DEFAULTS;
  } else {
    next = { ...current, [section]: DEFAULTS[section] } as DashboardSettings;
  }
  await writeFile(next);
  return next;
}

/** Replace the entire settings object with an imported value (validated).
 *  Webhook/topic fields equal to REDACTED_MASK are dropped (preserve existing). */
export async function importSettings(value: unknown): Promise<DashboardSettings> {
  const current = await loadSettings();
  const cleaned = stripRedactedMasks(value);
  const parsed = settingsSchema.parse(cleaned);
  if (isObject(value) && isObject((value as Record<string, unknown>).discord)) {
    const incoming = (value as Record<string, unknown>).discord as Record<string, unknown>;
    for (const key of ["webhookUrl", "webhookUrlResearch", "ntfyTopic"] as const) {
      if (isRedactedMask(incoming[key])) {
        const cur = current.discord[key];
        if (cur) parsed.discord[key] = cur;
      }
    }
  }
  await writeFile(parsed);
  return parsed;
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function stripRedactedMasks(value: unknown): unknown {
  if (!isObject(value)) return value;
  const cloned: Record<string, unknown> = { ...value };
  if (isObject(cloned.discord)) {
    const d = { ...(cloned.discord as Record<string, unknown>) };
    for (const key of ["webhookUrl", "webhookUrlResearch", "ntfyTopic"] as const) {
      if (isRedactedMask(d[key])) delete d[key];
    }
    cloned.discord = d;
  }
  return cloned;
}

// ─── Redaction (file-system aware: pulls env values) ────────────────────────

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
    display: s.display,
    live: s.live,
    defaults: s.defaults,
    notifications: s.notifications,
  };
}

/** Full settings for export — masks secret fields with REDACTED_MASK. */
export async function loadSettingsForExport(): Promise<ExportedSettings> {
  const s = await loadSettings();
  return {
    ...s,
    discord: {
      ...(s.discord.webhookUrl ? { webhookUrl: REDACTED_MASK } : {}),
      ...(s.discord.webhookUrlResearch ? { webhookUrlResearch: REDACTED_MASK } : {}),
      ...(s.discord.ntfyTopic ? { ntfyTopic: REDACTED_MASK } : {}),
    },
  };
}

/** Builds the env vars to inject into a child process so scripts/discord.sh
 *  sees the user's settings overrides ahead of .env / .env.local values. */
export function discordEnvFromSettings(s: DashboardSettings): Record<string, string> {
  const out: Record<string, string> = {};
  if (s.discord.webhookUrl) out.DISCORD_WEBHOOK_URL = s.discord.webhookUrl;
  if (s.discord.webhookUrlResearch) out.DISCORD_WEBHOOK_URL_RESEARCH = s.discord.webhookUrlResearch;
  if (s.discord.ntfyTopic) out.NTFY_TOPIC = s.discord.ntfyTopic;
  return out;
}
