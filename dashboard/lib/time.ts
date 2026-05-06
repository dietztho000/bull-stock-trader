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

/** Days between two `YYYY-MM-DD` strings (`to - from`, calendar arithmetic, TZ-invariant). */
export function daysBetweenISO(fromIso: string, toIso: string): number {
  const a = Date.parse(`${fromIso}T00:00:00Z`);
  const b = Date.parse(`${toIso}T00:00:00Z`);
  return Math.round((b - a) / 86400000);
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
 * string. DST-correct on transition days: tries both ET offsets and picks
 * the one whose UTC instant round-trips back to `HH:MM` in ET — handles
 * (a) spring-forward "lost" hour by falling back to the surrounding offset
 * and (b) fall-back ambiguous hour by preferring the first occurrence
 * (DST → standard, which is what the source-data writer would mean).
 */
export function etTimeStringToCT(timeHHMM: string, dateStr: string): string {
  const [hh, mm] = timeHHMM.split(":").map((s) => Number(s));
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return timeHHMM;

  // Try both candidate offsets (EDT -04:00, EST -05:00). Format each in ET
  // and pick the one whose ET wall-clock matches the input. On non-DST-
  // boundary days both candidates resolve to the same matching offset; on
  // a boundary day only one will round-trip correctly.
  for (const offset of ["-04:00", "-05:00"] as const) {
    const candidate = new Date(`${dateStr}T${pad(hh)}:${pad(mm)}:00${offset}`);
    const etClock = candidate.toLocaleTimeString("en-US", {
      timeZone: "America/New_York",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    if (etClock === `${pad(hh)}:${pad(mm)}`) {
      return fmtClockCT(candidate);
    }
  }
  // Fallback: empirical noon-probe (the legacy path) — used only on
  // genuinely ambiguous instants like 02:30 spring-forward, where neither
  // candidate matches and any answer is best-effort.
  const noonOffset = etOffsetForDate(dateStr);
  return fmtClockCT(new Date(`${dateStr}T${pad(hh)}:${pad(mm)}:00${noonOffset}`));
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/**
 * Returns the ET UTC-offset string ("-04:00" during EDT, "-05:00" during
 * EST) for the given `YYYY-MM-DD` at noon. Determined empirically via Intl
 * rather than hardcoding DST rules. Used as a fallback only — primary path
 * in `etTimeStringToCT` round-trips both candidate offsets.
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
