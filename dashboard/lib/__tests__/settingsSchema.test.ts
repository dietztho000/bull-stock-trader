import { describe, expect, it } from "vitest";
import {
  DEFAULTS,
  getSuppressionReason,
  isInQuietHours,
  isRedactedMask,
  isWebhookCategory,
  REDACTED_MASK,
  SECTION_KEYS,
  settingsSchema,
  type DashboardSettings,
} from "../settings.schema";

describe("settingsSchema parse — defaults + validation", () => {
  it("parses an empty object into a fully-populated DashboardSettings", () => {
    const result = settingsSchema.parse({});
    expect(result).toEqual(DEFAULTS);
    expect(result.display.theme).toBe("dark");
    expect(result.notifications.quietHours.startCT).toBe("22:00");
    expect(result.mascot.name).toBe("Trader Max");
    expect(result.bots).toEqual([]);
    expect(result.accounts).toEqual([]);
  });

  it("rejects invalid HH:MM in quiet hours", () => {
    expect(() =>
      settingsSchema.parse({
        notifications: { quietHours: { enabled: true, startCT: "25:00", endCT: "07:00" } },
      })
    ).toThrow(/HH:MM/);
  });

  it("rejects an unknown theme", () => {
    expect(() =>
      settingsSchema.parse({ display: { theme: "neon" } })
    ).toThrow();
  });

  it("rejects an empty mascot name", () => {
    expect(() =>
      settingsSchema.parse({ mascot: { name: "" } })
    ).toThrow();
  });

  it("DEFAULTS reaches every top-level section listed in SECTION_KEYS", () => {
    for (const key of SECTION_KEYS) {
      expect(DEFAULTS).toHaveProperty(key);
    }
  });

  it("preserves user-supplied valid overrides without dropping defaults", () => {
    const result = settingsSchema.parse({
      mascot: { name: "Brutus" },
      display: { theme: "light" },
    });
    expect(result.mascot.name).toBe("Brutus");
    expect(result.display.theme).toBe("light");
    // Other defaults untouched
    expect(result.notifications.quietHours.startCT).toBe("22:00");
  });
});

describe("isInQuietHours", () => {
  // Helper — build a Date that falls at a given CT clock time.
  function atCT(year: number, month: number, day: number, hour: number, minute: number): Date {
    // Construct a UTC moment and let fmtClockCT do the conversion. We pick
    // a fixed offset based on May (CDT = UTC-5).
    const utcHour = hour + 5; // CT → UTC
    return new Date(Date.UTC(year, month - 1, day, utcHour, minute));
  }

  it("returns false when start == end", () => {
    expect(isInQuietHours("12:00", "12:00", atCT(2026, 5, 5, 12, 0))).toBe(false);
  });

  it("returns true within a daytime window [10:00, 12:00)", () => {
    expect(isInQuietHours("10:00", "12:00", atCT(2026, 5, 5, 10, 0))).toBe(true);
    expect(isInQuietHours("10:00", "12:00", atCT(2026, 5, 5, 11, 30))).toBe(true);
  });

  it("returns false at the exclusive end of a daytime window", () => {
    expect(isInQuietHours("10:00", "12:00", atCT(2026, 5, 5, 12, 0))).toBe(false);
    expect(isInQuietHours("10:00", "12:00", atCT(2026, 5, 5, 9, 59))).toBe(false);
  });

  it("returns true inside an overnight window 22:00 → 07:00", () => {
    expect(isInQuietHours("22:00", "07:00", atCT(2026, 5, 5, 23, 30))).toBe(true);
    expect(isInQuietHours("22:00", "07:00", atCT(2026, 5, 5, 2, 15))).toBe(true);
    expect(isInQuietHours("22:00", "07:00", atCT(2026, 5, 5, 6, 59))).toBe(true);
  });

  it("returns false outside the overnight window", () => {
    expect(isInQuietHours("22:00", "07:00", atCT(2026, 5, 5, 7, 0))).toBe(false);
    expect(isInQuietHours("22:00", "07:00", atCT(2026, 5, 5, 12, 0))).toBe(false);
    expect(isInQuietHours("22:00", "07:00", atCT(2026, 5, 5, 21, 59))).toBe(false);
  });
});

describe("getSuppressionReason", () => {
  function settings(overrides: Partial<DashboardSettings> = {}): DashboardSettings {
    return settingsSchema.parse({ ...overrides });
  }

  it("returns null when category is enabled and quiet hours are disabled", () => {
    expect(getSuppressionReason(settings(), "fill")).toBeNull();
  });

  it("returns 'category-disabled' when the category filter is false", () => {
    const s = settingsSchema.parse({
      notifications: { webhookCategoryFilters: { fill: false } },
    });
    expect(getSuppressionReason(s, "fill")).toBe("category-disabled");
  });

  it("category-disabled wins over quiet-hours", () => {
    const s = settingsSchema.parse({
      notifications: {
        webhookCategoryFilters: { fill: false },
        quietHours: { enabled: true, startCT: "00:00", endCT: "23:59" },
      },
    });
    expect(getSuppressionReason(s, "fill")).toBe("category-disabled");
  });

  it("uses bot-level webhookCategoryFilters override when botId is provided", () => {
    const s = settingsSchema.parse({
      notifications: { webhookCategoryFilters: { eod: true } },
      accounts: [
        {
          id: "a1",
          label: "Acct 1",
          mode: "paper",
          endpoint: "https://paper-api.alpaca.markets",
          apiKeyEnc: "v1.iv.tag.ct",
          secretKeyEnc: "v1.iv.tag.ct",
          createdAt: "2026-05-05T00:00:00Z",
        },
      ],
      bots: [
        {
          id: "b1",
          name: "Bot 1",
          accountId: "a1",
          allocation: null,
          enabled: true,
          webhookCategoryFilters: { eod: false },
          createdAt: "2026-05-05T00:00:00Z",
        },
      ],
    });
    // Global says deliver eod, bot override says don't.
    expect(getSuppressionReason(s, "eod", new Date(), "b1")).toBe("category-disabled");
    // Without the bot id, the global filter applies — message goes through.
    expect(getSuppressionReason(s, "eod")).toBeNull();
  });
});

describe("redaction helpers", () => {
  it("isRedactedMask matches the canonical mask string", () => {
    expect(isRedactedMask(REDACTED_MASK)).toBe(true);
    expect(isRedactedMask("not redacted")).toBe(false);
    expect(isRedactedMask(null)).toBe(false);
    expect(isRedactedMask(42)).toBe(false);
  });
});

describe("isWebhookCategory", () => {
  it("recognizes the canonical category names", () => {
    for (const c of ["research", "fill", "midday", "stops", "eod"]) {
      expect(isWebhookCategory(c)).toBe(true);
    }
  });

  it("rejects unknown categories", () => {
    expect(isWebhookCategory("payments")).toBe(false);
    expect(isWebhookCategory("")).toBe(false);
  });
});
