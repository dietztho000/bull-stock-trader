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
  "bots",
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
    stops: z.boolean().default(true),
    eod: z.boolean().default(true),
    weekly: z.boolean().default(true),
    error: z.boolean().default(true),
    "auth-canary": z.boolean().default(true),
    alert: z.boolean().default(false),
  })
  .default({});

/** Per-bot Discord category override (audit F6). Each entry, when set,
 *  WINS over the global webhookCategoryFilters for sends scoped to that
 *  bot. Fields are optional so a bot can override one category without
 *  inheriting an explicit value for the others. */
const botWebhookCategoryFiltersSchema = z
  .object({
    research: z.boolean().optional(),
    fill: z.boolean().optional(),
    midday: z.boolean().optional(),
    stops: z.boolean().optional(),
    eod: z.boolean().optional(),
    weekly: z.boolean().optional(),
    error: z.boolean().optional(),
    "auth-canary": z.boolean().optional(),
    alert: z.boolean().optional(),
  })
  .optional();

/** The 10 cloud routines the registry can opt a bot in/out of (audit F3).
 *  Local-only commands (/portfolio, /trade, /benchmark) are not gated. */
const routineNameSchema = z.enum([
  "auth-canary",
  "pre-market",
  "market-open",
  "mid-morning",
  "late-morning",
  "midday",
  "stops",
  "afternoon",
  "daily-summary",
  "weekly-review",
]);

/** Per-bot routine opt-out (audit F3). Missing entries (or undefined)
 *  default to true — the bot runs that routine. Set explicitly to false
 *  to skip. `bash scripts/bots.sh list --routine=<name>` honors this. */
const botRoutineFilterSchema = z
  .record(routineNameSchema, z.boolean())
  .optional();

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

const mascotSchema = z
  .object({
    name: z.string().min(1).max(40).default("Trader Max"),
    confettiOnWin: z.boolean().default(true),
    showInNav: z.boolean().default(true),
    soundsEnabled: z.boolean().default(false),
    seasonalOutfits: z.boolean().default(true),
    idleAnimations: z.boolean().default(true),
  })
  .default({});

/**
 * Strategy thresholds. These mirror the hard rules in
 * `memory/TRADING-STRATEGY.md` and previously lived as inline constants
 * across components. Surfacing them here lets a paper-bot operator tweak
 * the dashboard's enforcement view without forking the bot's rulebook —
 * the bot's CLI routines still read from `.env` and `TRADING-STRATEGY.md`.
 */
const strategySchema = z
  .object({
    sectorCap: z.number().int().min(1).max(10).default(3),
    maxOpenPositions: z.number().int().min(1).max(20).default(6),
    dayBreakerPct: z.number().min(-20).max(0).default(-2),
    weekBreakerPct: z.number().min(-30).max(0).default(-4),
    celebrateThresholdPct: z.number().min(0).max(20).default(1.5),
    bullishThresholdPct: z.number().min(0).max(20).default(0.3),
    bearishThresholdPct: z.number().min(-20).max(0).default(-1.5),
    targetDeployedLowPct: z.number().min(0).max(100).default(75),
    targetDeployedHighPct: z.number().min(0).max(100).default(85),
    earningsGateDays: z.number().int().min(0).max(10).default(2),
    entryScoreMin: z.number().int().min(0).max(10).default(7),
  })
  .default({});

/** Alert rules. The dashboard evaluates these against `useStrategyState`
 *  and surfaces matching alerts in the toast system. Server-side dispatch
 *  to Discord/ntfy is a follow-up. */
const alertRuleSchema = z.object({
  id: z.string().min(1).max(64),
  enabled: z.boolean().default(true),
  type: z.enum([
    "earnings-gate-T-N",
    "drawdown-breaker",
    "sector-cap-reached",
    "sector-blocked",
    "cooldown-expiring",
    "rule-violation",
  ]),
  /** Trigger threshold in days for "earnings-gate-T-N" / "cooldown-expiring",
   *  ignored otherwise. */
  daysThreshold: z.number().int().min(0).max(30).default(2),
  channels: z
    .object({
      toast: z.boolean().default(true),
      discord: z.boolean().default(false),
      ntfy: z.boolean().default(false),
    })
    .default({}),
});

const alertsSchema = z
  .object({
    enabled: z.boolean().default(true),
    rules: z.array(alertRuleSchema).default([]),
  })
  .default({});

// ─── Multi-bot: accounts (Alpaca credential sets) and bots ─────────────

/** Slug used as a stable id for accounts and bots — lowercase, hyphenated,
 *  safe to embed in URLs and filesystem paths (memory/<bot>/<strategy>/). */
const slugSchema = z
  .string()
  .min(1)
  .max(40)
  .regex(/^[a-z0-9][a-z0-9-]*$/, "Use lowercase letters, digits, and hyphens (e.g. paper-100k)");

/** A single Alpaca credential set. May be live or paper. Multiple bots can
 *  bind to the same account when soft-allocating capital. Credentials are
 *  encrypted at rest (see lib/accountVault.ts). */
const accountSchema = z.object({
  id: slugSchema,
  label: z.string().min(1).max(60),
  mode: z.enum(["live", "paper"]),
  endpoint: z.string().url(),
  /** Encrypted ciphertext blobs ("v1.<iv>.<tag>.<ct>" base64 segments).
   *  Decrypt server-side only via accountVault.resolveAccountCreds. */
  apiKeyEnc: z.string().min(1),
  secretKeyEnc: z.string().min(1),
  /** Account's full capital — used by the allocation UI to show
   *  available-vs-allocated. Not enforced unless `hardCapAllocation` is
   *  set; user can over-commit by default. */
  totalCapital: z.number().positive().optional(),
  /** Audit F12 — when true, addBot/updateBot/saveSettings refuses to
   *  persist a registry whose enabled bots' allocation total exceeds the
   *  account's totalCapital. Requires totalCapital to be set; ignored
   *  otherwise. Optional so existing callers passing Account objects
   *  without this field stay valid; absence is treated as false. */
  hardCapAllocation: z.boolean().optional(),
  createdAt: z.string(),
});

/** A named trading agent bound to an account. `allocation` null = sole
 *  occupant of the account (use raw equity); a number = soft slice in $
 *  (sizing math + virtual equity computed via tagged client_order_id).
 *
 *  `memoryAlias` (audit A1): when set, the dashboard reads/writes this
 *  bot's memory under `memory/<memoryAlias>/<strategySlug>/` instead of
 *  `memory/<id>/<strategySlug>/`. Used by the seed-from-env migration to
 *  reserve the `live`/`paper` slugs as user-creatable while still pointing
 *  the seeded bots at the legacy on-disk memory tree. */
const botSchema = z.object({
  id: slugSchema,
  name: z.string().min(1).max(60),
  accountId: slugSchema,
  allocation: z.number().positive().nullable(),
  strategySlug: z.string().min(1).max(40).default("default"),
  memoryAlias: slugSchema.optional(),
  enabled: z.boolean().default(true),
  /** Per-bot Discord webhook override (audit F10). When set, dashboard-
   *  originated sends scoped to this bot use this webhook instead of the
   *  global `discord.webhookUrl`. Optional and back-compat — bots without
   *  the field fall through to the global webhook. */
  discordWebhookUrl: webhookUrlSchema.nullable().optional(),
  /** Per-bot category filter override (audit F6). When a category is
   *  set explicitly here, it wins over `discord.webhookCategoryFilters`
   *  for sends scoped to this bot. Lets `momentum-10k` send only fills
   *  while `legacy-live` continues to send everything. */
  webhookCategoryFilters: botWebhookCategoryFiltersSchema,
  /** Per-routine opt-out (audit F3). When set to false for a routine
   *  name, the cloud fan-out skips this bot for that routine. Missing
   *  or true means run as normal. */
  routineFilter: botRoutineFilterSchema,
  /** Sandbox sentinel (audit F7) — auto-disables this bot when the
   *  configured number of consecutive losses fires. `null` = disabled. */
  sentinel: z
    .object({
      enabled: z.boolean().default(false),
      consecutiveLossesCap: z.number().int().min(2).max(20).default(3),
    })
    .nullable()
    .optional(),
  /** Audit F5 — trip history. Each entry is one auto-disable event the
   *  sentinel fired. The UI uses the most recent entry to distinguish
   *  "auto-disabled by sentinel" from "manually disabled" on the bot card.
   *  Bounded server-side to the last 20 trips so the array can't grow
   *  unbounded over the bot's lifetime. `reason` distinguishes the two
   *  trip categories (consecutive losses vs. consecutive healthcheck
   *  failures) so the UI can label them appropriately. `detail` carries
   *  the credential error for healthcheck-failure trips. */
  sentinelTrips: z
    .array(
      z.object({
        trippedAt: z.string(),
        cap: z.number().int().positive(),
        symbols: z.array(z.string()),
        reason: z
          .enum(["consecutive-losses", "healthcheck-failure"])
          .default("consecutive-losses"),
        detail: z.string().optional(),
      })
    )
    .default([])
    .optional(),
  createdAt: z.string(),
});

/** Audit F2 — vault rotation cadence. When `rotateEveryDays` is a positive
 *  integer, the dashboard surfaces an "overdue" warning on the bots page
 *  once the on-disk fingerprint marker's `rekeyedAt` is older than that
 *  many days. Auto-trigger is intentionally not wired (credential rotation
 *  needs user oversight). */
const vaultSettingsSchema = z
  .object({
    rotateEveryDays: z.number().int().positive().max(3650).nullable().optional(),
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
  vault: vaultSettingsSchema,
  display: displaySchema,
  live: liveSchema,
  defaults: defaultsSchema,
  notifications: notificationsSchema,
  mascot: mascotSchema,
  strategy: strategySchema,
  alerts: alertsSchema,
  accounts: z.array(accountSchema).default([]),
  bots: z.array(botSchema).default([]),
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
export type Account = z.infer<typeof accountSchema>;
export type Bot = z.infer<typeof botSchema>;

export const SECTION_KEYS = [
  "discord",
  "display",
  "live",
  "defaults",
  "notifications",
  "mascot",
  "strategy",
  "alerts",
  "accounts",
  "bots",
] as const;
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
  vault: z
    .object({
      rotateEveryDays: z.number().int().positive().max(3650).nullable().optional(),
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
          stops: z.boolean().optional(),
          eod: z.boolean().optional(),
          weekly: z.boolean().optional(),
          error: z.boolean().optional(),
          "auth-canary": z.boolean().optional(),
          alert: z.boolean().optional(),
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
  mascot: z
    .object({
      name: z.string().min(1).max(40).optional(),
      confettiOnWin: z.boolean().optional(),
      showInNav: z.boolean().optional(),
      soundsEnabled: z.boolean().optional(),
      seasonalOutfits: z.boolean().optional(),
      idleAnimations: z.boolean().optional(),
    })
    .optional(),
  strategy: z
    .object({
      sectorCap: z.number().int().min(1).max(10).optional(),
      maxOpenPositions: z.number().int().min(1).max(20).optional(),
      dayBreakerPct: z.number().min(-20).max(0).optional(),
      weekBreakerPct: z.number().min(-30).max(0).optional(),
      celebrateThresholdPct: z.number().min(0).max(20).optional(),
      bullishThresholdPct: z.number().min(0).max(20).optional(),
      bearishThresholdPct: z.number().min(-20).max(0).optional(),
      targetDeployedLowPct: z.number().min(0).max(100).optional(),
      targetDeployedHighPct: z.number().min(0).max(100).optional(),
      earningsGateDays: z.number().int().min(0).max(10).optional(),
      entryScoreMin: z.number().int().min(0).max(10).optional(),
    })
    .optional(),
  alerts: z
    .object({
      enabled: z.boolean().optional(),
      rules: z
        .array(
          z.object({
            id: z.string().min(1).max(64),
            enabled: z.boolean().default(true),
            type: z.enum([
              "earnings-gate-T-N",
              "drawdown-breaker",
              "sector-cap-reached",
              "sector-blocked",
              "cooldown-expiring",
              "rule-violation",
            ]),
            daysThreshold: z.number().int().min(0).max(30).default(2),
            channels: z
              .object({
                toast: z.boolean().default(true),
                discord: z.boolean().default(false),
                ntfy: z.boolean().default(false),
              })
              .default({}),
          })
        )
        .optional(),
    })
    .optional(),
  /** Full replacement of the accounts list. Mutations go through dedicated
   *  /api/accounts routes that handle encryption + validation; this branch
   *  exists for /api/settings/import. */
  accounts: z.array(accountSchema).optional(),
  /** Full replacement of the bots list. Same rationale as `accounts`. */
  bots: z.array(botSchema).optional(),
});

export type AlertRule = z.infer<typeof alertRuleSchema>;

export type SettingsPatch = z.infer<typeof settingsPatchSchema>;

// ─── Redacted account view (returned by GET /api/accounts) ──────────────

/** A safe-for-client account: encrypted credential blobs replaced with a
 *  short hint ("…last4") so the UI can show "Set" without ever surfacing
 *  ciphertext (which would still be useless without the vault key, but
 *  there's no reason to ship it). */
export type RedactedAccount = {
  id: string;
  label: string;
  mode: "live" | "paper";
  endpoint: string;
  apiKeyHint: string | null;
  totalCapital: number | null;
  createdAt: string;
};

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
  mascot: DashboardSettings["mascot"];
  strategy: DashboardSettings["strategy"];
  alerts: DashboardSettings["alerts"];
  accounts: RedactedAccount[];
  bots: DashboardSettings["bots"];
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

/** Returns null if the message should send; otherwise the reason it was
 *  suppressed. When `botId` is provided and that bot has a matching entry
 *  in its `webhookCategoryFilters` override (audit F6), the bot's value
 *  WINS — `momentum-10k` can disable `eod` while `legacy-live` continues
 *  to receive it from the same global filter. */
export function getSuppressionReason(
  s: DashboardSettings,
  category: WebhookCategory,
  now: Date = new Date(),
  botId?: string
): SuppressionReason | null {
  let filter = s.notifications.webhookCategoryFilters[category];
  if (botId) {
    const bot = s.bots.find((b) => b.id === botId);
    const botOverride = bot?.webhookCategoryFilters?.[category];
    if (botOverride !== undefined) filter = botOverride;
  }
  if (filter === false) return "category-disabled";
  if (s.notifications.quietHours.enabled) {
    const { startCT, endCT } = s.notifications.quietHours;
    if (isInQuietHours(startCT, endCT, now)) return "quiet-hours";
  }
  return null;
}

export function isWebhookCategory(value: string): value is WebhookCategory {
  return [
    "research",
    "fill",
    "midday",
    "stops",
    "eod",
    "weekly",
    "error",
    "auth-canary",
    "alert",
  ].includes(value);
}
