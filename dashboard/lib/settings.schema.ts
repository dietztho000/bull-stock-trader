import { z } from "zod";
import { fmtClockCT } from "./time";

const webhookUrlSchema = z
  .string()
  .url()
  .refine(
    (v) => v.startsWith("https://discord.com/api/webhooks/") || v.startsWith("https://discordapp.com/api/webhooks/"),
    "Discord webhook URLs must start with https://discord.com/api/webhooks/"
  );

const optionalWebhook = webhookUrlSchema.nullable().optional();

// ─── Section schemas ────────────────────────────────────────────

const themeSchema = z.enum(["dark", "light", "auto"]);
const landingPageSchema = z.enum([
  "overview",
  "trades",
  "calendar",
  "journal",
  "analytics",
  "strategy",
]);
const numberFormatSchema = z.enum(["compact", "full"]);
const currencySchema = z.enum(["USD", "raw"]);

const displaySchema = z
  .object({
    theme: themeSchema.default("dark"),
    defaultLandingPage: landingPageSchema.default("overview"),
    numberFormat: numberFormatSchema.default("full"),
    currency: currencySchema.default("USD"),
    hideTinyPositionsBelow: z.number().min(0).default(0),
  })
  .default({});

const liveSchema = z
  .object({
    autoRefreshEnabled: z.boolean().default(true),
    pollIntervalMs: z.number().int().min(1000).max(600000).default(5000),
    refreshOnFocus: z.boolean().default(true),
    maxPositionsShown: z.number().int().min(0).max(500).default(0),
  })
  .default({});

const accountModeSchema = z.enum(["live", "paper"]);
const chartRangeSchema = z.enum(["30d", "90d", "ytd", "1y", "all"]);
const tradesFilterSchema = z.enum(["all", "open", "closed-30d", "closed-90d"]);

const defaultsSchema = z
  .object({
    defaultAccountMode: accountModeSchema.default("live"),
    chartDateRangeDefault: chartRangeSchema.default("ytd"),
    tradesPageDefaultFilter: tradesFilterSchema.default("all"),
  })
  .default({});

const webhookCategoryFiltersSchema = z
  .object({
    research: z.boolean().default(true),
    fill: z.boolean().default(true),
    midday: z.boolean().default(true),
    eod: z.boolean().default(true),
    weekly: z.boolean().default(true),
    error: z.boolean().default(true),
  })
  .default({});

const HHMM_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const hhmmSchema = z.string().regex(HHMM_RE, "Use HH:MM (24h)");

const quietHoursSchema = z
  .object({
    enabled: z.boolean().default(false),
    startCT: hhmmSchema.default("22:00"),
    endCT: hhmmSchema.default("07:00"),
  })
  .default({});

const notificationsSchema = z
  .object({
    webhookCategoryFilters: webhookCategoryFiltersSchema,
    quietHours: quietHoursSchema,
    desktopNotificationsEnabled: z.boolean().default(false),
  })
  .default({});

export const settingsSchema = z.object({
  discord: z
    .object({
      webhookUrl: optionalWebhook,
      webhookUrlResearch: optionalWebhook,
      ntfyTopic: z.string().min(1).max(80).nullable().optional(),
    })
    .default({}),
  display: displaySchema,
  live: liveSchema,
  defaults: defaultsSchema,
  notifications: notificationsSchema,
});

export type DashboardSettings = z.infer<typeof settingsSchema>;
export type Theme = z.infer<typeof themeSchema>;
export type LandingPage = z.infer<typeof landingPageSchema>;
export type NumberFormatPref = z.infer<typeof numberFormatSchema>;
export type CurrencyPref = z.infer<typeof currencySchema>;
export type AccountModeDefault = z.infer<typeof accountModeSchema>;
export type ChartDateRange = z.infer<typeof chartRangeSchema>;
export type TradesFilter = z.infer<typeof tradesFilterSchema>;
export type WebhookCategory = keyof z.infer<typeof webhookCategoryFiltersSchema>;

export const SECTION_KEYS = ["discord", "display", "live", "defaults", "notifications"] as const;
export type SectionKey = (typeof SECTION_KEYS)[number];

/** Defaults synthesized from the schema — used by reset and the client. */
export const DEFAULTS: DashboardSettings = settingsSchema.parse({});

// ─── Patch schema (every field optional, empty-string clears strings) ────────

export const settingsPatchSchema = z.object({
  discord: z
    .object({
      webhookUrl: z.union([webhookUrlSchema, z.literal(""), z.null()]).optional(),
      webhookUrlResearch: z.union([webhookUrlSchema, z.literal(""), z.null()]).optional(),
      ntfyTopic: z.union([z.string().min(1).max(80), z.literal(""), z.null()]).optional(),
    })
    .optional(),
  display: z
    .object({
      theme: themeSchema.optional(),
      defaultLandingPage: landingPageSchema.optional(),
      numberFormat: numberFormatSchema.optional(),
      currency: currencySchema.optional(),
      hideTinyPositionsBelow: z.number().min(0).optional(),
    })
    .optional(),
  live: z
    .object({
      autoRefreshEnabled: z.boolean().optional(),
      pollIntervalMs: z.number().int().min(1000).max(600000).optional(),
      refreshOnFocus: z.boolean().optional(),
      maxPositionsShown: z.number().int().min(0).max(500).optional(),
    })
    .optional(),
  defaults: z
    .object({
      defaultAccountMode: accountModeSchema.optional(),
      chartDateRangeDefault: chartRangeSchema.optional(),
      tradesPageDefaultFilter: tradesFilterSchema.optional(),
    })
    .optional(),
  notifications: z
    .object({
      webhookCategoryFilters: z
        .object({
          research: z.boolean().optional(),
          fill: z.boolean().optional(),
          midday: z.boolean().optional(),
          eod: z.boolean().optional(),
          weekly: z.boolean().optional(),
          error: z.boolean().optional(),
        })
        .optional(),
      quietHours: z
        .object({
          enabled: z.boolean().optional(),
          startCT: hhmmSchema.optional(),
          endCT: hhmmSchema.optional(),
        })
        .optional(),
      desktopNotificationsEnabled: z.boolean().optional(),
    })
    .optional(),
});

export type SettingsPatch = z.infer<typeof settingsPatchSchema>;

// ─── Redacted (returned by GET /api/settings) ────────────────────────────────

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
  display: DashboardSettings["display"];
  live: DashboardSettings["live"];
  defaults: DashboardSettings["defaults"];
  notifications: DashboardSettings["notifications"];
};

/** Mask token used in exported JSON for secret fields. */
export const REDACTED_MASK = "••••(redacted)";

export type ExportedSettings = Omit<DashboardSettings, "discord"> & {
  discord: {
    webhookUrl?: string;
    webhookUrlResearch?: string;
    ntfyTopic?: string;
  };
};

/** True when a value came from the export mask and should not clobber existing secrets. */
export function isRedactedMask(value: unknown): boolean {
  return typeof value === "string" && value === REDACTED_MASK;
}

// ─── Notification gate (pure — usable on client + server) ────────────────────

/** Returns true if the current CT time falls within `[startCT, endCT)`.
 *  Supports overnight windows (start > end). */
export function isInQuietHours(
  startCT: string,
  endCT: string,
  now: Date = new Date()
): boolean {
  const cur = fmtClockCT(now); // "HH:MM"
  if (startCT === endCT) return false;
  if (startCT < endCT) {
    return cur >= startCT && cur < endCT;
  }
  // Overnight: e.g. 22:00 → 07:00
  return cur >= startCT || cur < endCT;
}

export type SuppressionReason = "category-disabled" | "quiet-hours";

/** Returns null if the message should send; otherwise the reason it was suppressed. */
export function getSuppressionReason(
  s: DashboardSettings,
  category: WebhookCategory,
  now: Date = new Date()
): SuppressionReason | null {
  const filter = s.notifications.webhookCategoryFilters[category];
  if (filter === false) return "category-disabled";
  if (s.notifications.quietHours.enabled) {
    const { startCT, endCT } = s.notifications.quietHours;
    if (isInQuietHours(startCT, endCT, now)) return "quiet-hours";
  }
  return null;
}

export function isWebhookCategory(value: string): value is WebhookCategory {
  return ["research", "fill", "midday", "eod", "weekly", "error"].includes(value);
}
