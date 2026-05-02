# Dashboard conventions

## Timezone

All times displayed or computed in this dashboard are **Central Time (`America/Chicago`)**, including trading-day / week-start / Friday-detection logic. NYSE trades on ET, but a "trading day" in this app follows the user's clock — which matches the host (the bot writes `CDT` timestamps to memory files).

**Always use the helpers in `lib/time.ts`. Never** write any of these:

- `timeZone: "America/New_York"` / `"UTC"` / `"America/Los_Angeles"` etc.
- Bare `toLocaleString()` / `toLocaleTimeString()` / `toLocaleDateString()` (no `timeZone` option)
- `getUTCDay()` / `getUTCDate()` for "what day is it" decisions

Use these instead:

| Need | Helper |
|---|---|
| Today's date as `YYYY-MM-DD` | `todayInCT()` |
| A timestamp's CT calendar date | `dateInCT(ts)` |
| Trading-day / Friday check | `isTradingDayCT(dateStr)` / `isFridayCT(dateStr)` |
| Monday of current week | `currentWeekMondayCT()` |
| `HH:MM` 24h | `fmtClockCT(ts)` |
| `h:MM AM/PM` | `fmtTimeOfDayCT(ts)` |
| `YYYY-MM-DD HH:MM` | `fmtDateTimeCT(ts)` |
| Short weekday `Mon`/`Tue` | `fmtWeekdayShortCT(iso)` |
| `Mon h:MM AM/PM` | `fmtWeekdayTimeCT(ts)` |
| Convert ET clock string from a memory file | `etTimeStringToCT(time, date)` |

User-visible labels say `CT` (or omit the TZ when context is unambiguous). The constant `TZ_LABEL = "CT"` is exported for use in JSX.

### Source data stored in ET

`memory/ECONOMIC-CALENDAR.md` has a `Time (ET)` column — that's the bot's storage format and stays as-is. Convert via `etTimeStringToCT(entry.time, entry.date)` at the display layer.

### Pure ISO-date arithmetic is fine

`addDaysISO(iso, n)` in `lib/time.ts` adds days to a `YYYY-MM-DD` string without touching timezones. `getUTCDate()`/`setUTCDate()` is acceptable when working strictly with calendar dates that have no time component (e.g. `lib/backtest/runner.ts` bar fetching).
