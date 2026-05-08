import "server-only";
import path from "node:path";
import fs from "node:fs/promises";
import { resolveMemoryFile, setMemoryAliases } from "./memoryPath";
import {
  DEFAULTS,
  REDACTED_MASK,
  settingsSchema,
  type Account,
  type Bot,
  type DashboardSettings,
  type ExportedSettings,
  type RedactedAccount,
  type RedactedField,
  type RedactedSettings,
  type SectionKey,
  type SettingsPatch,
  type StrategyDefinition,
  type StrategyParam,
  type StrategyParamKind,
  isRedactedMask,
} from "./settings.schema";
import { credentialHint } from "./accountVault";

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
  Account,
  Bot,
  DashboardSettings,
  ExportedSettings,
  RedactedAccount,
  RedactedField,
  RedactedSettings,
  SectionKey,
  SettingsPatch,
  StrategyDefinition,
  StrategyParam,
  StrategyParamKind,
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

const FILE = resolveMemoryFile("dashboard-settings.json");

const EMPTY: DashboardSettings = DEFAULTS;

export async function loadSettings(): Promise<DashboardSettings> {
  let next: DashboardSettings = EMPTY;
  try {
    const raw = await fs.readFile(FILE, "utf8");
    const parsed = JSON.parse(raw);
    const result = settingsSchema.safeParse(parsed);
    if (result.success) next = result.data;
  } catch {
    // fall through to EMPTY
  }
  // Audit A1 — keep the bot → memory-directory cache in sync with the
  // current bot list. Cheap (one Map rebuild per settings read).
  setMemoryAliases(
    next.bots
      .filter((b) => b.memoryAlias && b.memoryAlias !== b.id)
      .map((b) => [b.id, b.memoryAlias!] as const)
  );
  return next;
}

async function writeFile(next: DashboardSettings) {
  await fs.mkdir(path.dirname(FILE), { recursive: true });
  await fs.writeFile(FILE, JSON.stringify(next, null, 2) + "\n", "utf8");
}

export async function saveSettings(patch: SettingsPatch): Promise<DashboardSettings> {
  const current = await loadSettings();
  const next: DashboardSettings = {
    discord: { ...current.discord },
    vault: { ...current.vault },
    display: { ...current.display },
    live: { ...current.live },
    defaults: { ...current.defaults },
    notifications: {
      ...current.notifications,
      webhookCategoryFilters: { ...current.notifications.webhookCategoryFilters },
      quietHours: { ...current.notifications.quietHours },
    },
    mascot: { ...current.mascot },
    strategy: { ...current.strategy },
    alerts: {
      ...current.alerts,
      rules: current.alerts.rules.map((r) => ({
        ...r,
        channels: { ...r.channels },
      })),
    },
    accounts: current.accounts.map((a) => ({ ...a })),
    bots: current.bots.map((b) => ({ ...b })),
    strategies: current.strategies.map((s) => ({
      ...s,
      params: s.params.map((p) => cloneStrategyParam(p)),
    })),
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

  if (patch.vault) Object.assign(next.vault, patch.vault);
  if (patch.display) Object.assign(next.display, patch.display);
  if (patch.live) Object.assign(next.live, patch.live);
  if (patch.defaults) Object.assign(next.defaults, patch.defaults);
  if (patch.mascot) Object.assign(next.mascot, patch.mascot);
  if (patch.strategy) Object.assign(next.strategy, patch.strategy);
  if (patch.alerts) {
    if (patch.alerts.enabled !== undefined) next.alerts.enabled = patch.alerts.enabled;
    if (patch.alerts.rules !== undefined) {
      next.alerts.rules = patch.alerts.rules.map((r) => ({
        id: r.id,
        enabled: r.enabled ?? true,
        type: r.type,
        daysThreshold: r.daysThreshold ?? 2,
        channels: {
          toast: r.channels?.toast ?? true,
          discord: r.channels?.discord ?? false,
          ntfy: r.channels?.ntfy ?? false,
        },
      }));
    }
  }
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
  if (patch.accounts !== undefined) next.accounts = patch.accounts.map((a) => ({ ...a }));
  if (patch.bots !== undefined) next.bots = patch.bots.map((b) => ({ ...b }));
  if (patch.strategies !== undefined) {
    next.strategies = patch.strategies.map((s) => ({
      ...s,
      params: s.params.map((p) => cloneStrategyParam(p)),
    }));
  }

  assertReferentialIntegrity(next);
  await writeFile(next);
  return next;
}

/** Throws if a bot references a missing account, or if account/bot ids are
 *  duplicated. Allocation overruns are allowed by default (warned in UI),
 *  but accounts with `hardCapAllocation = true` (audit F12) refuse the
 *  save when sum(bot.allocation) on this account exceeds totalCapital. */
function assertReferentialIntegrity(s: DashboardSettings): void {
  const accountIds = new Set<string>();
  for (const a of s.accounts) {
    if (accountIds.has(a.id)) throw new Error(`Duplicate account id: ${a.id}`);
    accountIds.add(a.id);
  }
  const botIds = new Set<string>();
  for (const b of s.bots) {
    if (botIds.has(b.id)) throw new Error(`Duplicate bot id: ${b.id}`);
    botIds.add(b.id);
    if (!accountIds.has(b.accountId)) {
      throw new Error(`Bot "${b.id}" references missing account "${b.accountId}"`);
    }
  }
  for (const a of s.accounts) {
    if (!a.hardCapAllocation) continue;
    if (a.totalCapital == null) continue;
    const sumAllocated = s.bots
      .filter((b) => b.accountId === a.id && b.allocation != null && b.enabled)
      .reduce((acc, b) => acc + (b.allocation ?? 0), 0);
    if (sumAllocated > a.totalCapital) {
      throw new Error(
        `Hard-cap account "${a.id}" rejected save: bots' allocation total ` +
          `$${sumAllocated.toLocaleString()} exceeds totalCapital $${a.totalCapital.toLocaleString()}. ` +
          `Reduce a bot's allocation, raise totalCapital, or disable hardCapAllocation.`
      );
    }
  }
}

/** Deep-clones a `StrategyParam` so saveSettings's persistence layer can't
 *  mutate the caller's input. The discriminated union has a `table` variant
 *  whose nested `rows` array would otherwise be shared by reference. */
function cloneStrategyParam(p: StrategyParam): StrategyParam {
  if (p.kind === "table") {
    return { ...p, rows: p.rows.map((row) => ({ ...row })) };
  }
  if (p.kind === "enum") {
    return { ...p, options: [...p.options] };
  }
  return { ...p };
}

// ─── Account-level mutations (used by /api/accounts routes) ──────────────

export async function listAccounts(): Promise<Account[]> {
  return (await loadSettings()).accounts;
}

export async function listBots(): Promise<Bot[]> {
  return (await loadSettings()).bots;
}

/** Read-only helpers for the strategies registry. Phase 1 of the multi-
 *  strategy upgrade. CRUD mutations land in Phase 2 with the admin UI. */
export async function listStrategies(): Promise<StrategyDefinition[]> {
  return (await loadSettings()).strategies;
}

export async function getStrategy(slug: string): Promise<StrategyDefinition | null> {
  const all = await listStrategies();
  return all.find((s) => s.slug === slug) ?? null;
}

export async function addAccount(account: Account): Promise<DashboardSettings> {
  const current = await loadSettings();
  if (current.accounts.some((a) => a.id === account.id)) {
    throw new Error(`Account id "${account.id}" already exists`);
  }
  return saveSettings({ accounts: [...current.accounts, account] });
}

export async function updateAccount(
  id: string,
  patch: Partial<
    Pick<
      Account,
      | "label"
      | "totalCapital"
      | "endpoint"
      | "apiKeyEnc"
      | "secretKeyEnc"
      | "hardCapAllocation"
    >
  >
): Promise<DashboardSettings> {
  const current = await loadSettings();
  const idx = current.accounts.findIndex((a) => a.id === id);
  if (idx < 0) throw new Error(`Account "${id}" not found`);
  const nextAccounts = current.accounts.slice();
  nextAccounts[idx] = { ...nextAccounts[idx], ...patch };
  return saveSettings({ accounts: nextAccounts });
}

export async function deleteAccount(id: string): Promise<DashboardSettings> {
  const current = await loadSettings();
  const blockingBots = current.bots.filter((b) => b.accountId === id).map((b) => b.id);
  if (blockingBots.length > 0) {
    throw new Error(
      `Cannot delete account "${id}" — bots still bound to it: ${blockingBots.join(", ")}. Delete those bots first.`
    );
  }
  return saveSettings({ accounts: current.accounts.filter((a) => a.id !== id) });
}

export async function addBot(bot: Bot): Promise<DashboardSettings> {
  const current = await loadSettings();
  if (current.bots.some((b) => b.id === bot.id)) {
    throw new Error(`Bot id "${bot.id}" already exists`);
  }
  return saveSettings({ bots: [...current.bots, bot] });
}

export async function updateBot(
  id: string,
  patch: Partial<
    Pick<
      Bot,
      | "name"
      | "allocation"
      | "strategySlug"
      | "enabled"
      | "accountId"
      | "discordWebhookUrl"
      | "sentinel"
      | "sentinelTrips"
    >
  >
): Promise<DashboardSettings> {
  const current = await loadSettings();
  const idx = current.bots.findIndex((b) => b.id === id);
  if (idx < 0) throw new Error(`Bot "${id}" not found`);
  const nextBots = current.bots.slice();
  nextBots[idx] = { ...nextBots[idx], ...patch };
  return saveSettings({ bots: nextBots });
}

export async function deleteBot(id: string): Promise<DashboardSettings> {
  const current = await loadSettings();
  return saveSettings({ bots: current.bots.filter((b) => b.id !== id) });
}

export function redactAccount(a: Account): RedactedAccount {
  return {
    id: a.id,
    label: a.label,
    mode: a.mode,
    endpoint: a.endpoint,
    apiKeyHint: credentialHint(a.apiKeyEnc),
    totalCapital: a.totalCapital ?? null,
    createdAt: a.createdAt,
  };
}

/** Reset a single section (or all) to schema defaults.
 *  `accounts` and `bots` are explicitly excluded — wiping them via the
 *  generic reset path would silently destroy encrypted credentials and
 *  registered bots. Use the dedicated /api/accounts and /api/bots DELETE
 *  routes instead. */
export async function resetSection(section: SectionKey | "all"): Promise<DashboardSettings> {
  if (section === "accounts" || section === "bots" || section === "strategies") {
    throw new Error(
      `Refusing to reset "${section}" via resetSection — use the dedicated /api/${section}/[id] route to remove individual records.`
    );
  }
  const current = await loadSettings();
  let next: DashboardSettings;
  if (section === "all") {
    next = {
      ...DEFAULTS,
      accounts: current.accounts,
      bots: current.bots,
      strategies: current.strategies,
    };
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
    mascot: s.mascot,
    strategy: s.strategy,
    alerts: s.alerts,
    accounts: s.accounts.map(redactAccount),
    bots: s.bots,
    strategies: s.strategies,
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
