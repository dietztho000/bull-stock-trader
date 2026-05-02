/**
 * Single source of truth for all date/time work in the dashboard.
 *
 * Everything user-visible — and almost everything internal — is anchored to
 * Central Time. Do NOT call `toLocaleString()`/`toLocaleTimeString()` without
 * `timeZone: APP_TZ`, do NOT hand-roll `timeZone: "America/New_York"`, and do
 * NOT use `getUTCDay()` for "what day is it" logic. Use the helpers below.
 */

export const APP_TZ = "America/Chicago";
export const TZ_LABEL = "CT";

type DateInput = string | number | Date;

function toDate(input: DateInput): Date {
  return input instanceof Date ? input : new Date(input);
}

// ───────────────────────── Date bucketing ─────────────────────────

/** Today's date in CT as `YYYY-MM-DD`. */
export function todayInCT(now: Date = new Date()): string {
  return now.toLocaleDateString("en-CA", { timeZone: APP_TZ });
}

/** A specific timestamp's CT calendar date as `YYYY-MM-DD`. */
export function dateInCT(input: DateInput): string {
  return toDate(input).toLocaleDateString("en-CA", { timeZone: APP_TZ });
}

/** 0 (Sun) – 6 (Sat) in CT. */
export function dayOfWeekCT(input: DateInput): number {
  // Use a long weekday so locale never abbreviates ambiguously.
  const name = toDate(input).toLocaleDateString("en-US", {
    timeZone: APP_TZ,
    weekday: "long",
  });
  return ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"].indexOf(
    name
  );
}

/** Mon–Fri in CT (no holiday awareness — matches prior behavior). */
export function isTradingDayCT(dateStr: string): boolean {
  const dow = dayOfWeekCT(`${dateStr}T12:00:00Z`);
  return dow >= 1 && dow <= 5;
}

export function isFridayCT(dateStr: string): boolean {
  return dayOfWeekCT(`${dateStr}T12:00:00Z`) === 5;
}

/**
 * Monday of the current week in CT, as `YYYY-MM-DD`. Mondays return
 * themselves; Sundays return the *previous* Monday (to match the existing
 * convention in `app/page.tsx` and `weekStartPortfolio.ts`).
 */
export function currentWeekMondayCT(now: Date = new Date()): string {
  const today = todayInCT(now);
  const dow = dayOfWeekCT(`${today}T12:00:00Z`);
  const diff = dow === 0 ? -6 : 1 - dow;
  return addDaysISO(today, diff);
}

/** Add `days` to an ISO `YYYY-MM-DD` string (calendar arithmetic, TZ-invariant). */
export function addDaysISO(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// ───────────────────────── Display formatters ─────────────────────────

/** `HH:MM` 24-hour in CT. */
export function fmtClockCT(input: DateInput): string {
  return toDate(input).toLocaleTimeString("en-US", {
    timeZone: APP_TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

/** `h:MM AM/PM` in CT. */
export function fmtTimeOfDayCT(input: DateInput): string {
  return toDate(input).toLocaleTimeString("en-US", {
    timeZone: APP_TZ,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

/** `YYYY-MM-DD HH:MM` in CT. */
export function fmtDateTimeCT(input: DateInput): string {
  return `${dateInCT(input)} ${fmtClockCT(input)}`;
}

/** Short weekday for an ISO date interpreted as a CT calendar day. */
export function fmtWeekdayShortCT(iso: string): string {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", {
    timeZone: APP_TZ,
    weekday: "short",
  });
}

/** `Mon h:MM AM/PM` in CT, e.g. for "next market open". */
export function fmtWeekdayTimeCT(input: DateInput): string {
  return toDate(input).toLocaleString("en-US", {
    timeZone: APP_TZ,
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

// ───────────────────────── Source-data ET → CT conversion ─────────────────────────

/**
 * Convert an `HH:MM` clock string that was stored as ET (e.g. the
 * `ECONOMIC-CALENDAR.md` `Time (ET)` column) into the equivalent CT clock
 * string. Builds a real `Date` so DST is handled correctly even on the rare
 * transition-day mismatch.
 */
export function etTimeStringToCT(timeHHMM: string, dateStr: string): string {
  const [hh, mm] = timeHHMM.split(":").map((s) => Number(s));
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return timeHHMM;
  // Build a UTC instant that, when read in ET, is `dateStr HH:MM`.
  // Easier: format an ISO with ET offset for the date in question, then
  // re-format via Intl in CT.
  const etOffset = etOffsetForDate(dateStr); // e.g. "-04:00" or "-05:00"
  const isoEt = `${dateStr}T${pad(hh)}:${pad(mm)}:00${etOffset}`;
  return fmtClockCT(new Date(isoEt));
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/**
 * Returns the ET UTC-offset string ("-04:00" during EDT, "-05:00" during
 * EST) for the given `YYYY-MM-DD`. Determined empirically via Intl rather
 * than hardcoding DST rules.
 */
function etOffsetForDate(dateStr: string): string {
  const probe = new Date(`${dateStr}T12:00:00Z`);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    timeZoneName: "shortOffset",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(probe);
  const tzPart = parts.find((p) => p.type === "timeZoneName")?.value ?? "GMT-5";
  const m = tzPart.match(/GMT([+-]\d{1,2})(?::?(\d{2}))?/);
  if (!m) return "-05:00";
  const sign = m[1].startsWith("-") ? "-" : "+";
  const hours = pad(Math.abs(Number(m[1])));
  const minutes = m[2] ?? "00";
  return `${sign}${hours}:${minutes}`;
}
