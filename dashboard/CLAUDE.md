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

## Memory file IO

**Every** read of a `memory/` file goes through `readMemory(file, ctx?)` from `lib/memoryPath.ts`. Never `fs.readFile` directly on a memory path, never compute a path off `BOT_ROOT`. The DAILY-SUMMARY orphan that triggered the 2026-05 audit happened because one parser bypassed this layer:

- `readMemory()` consults `MEMORY_FILE_SCOPE` to resolve shared vs per-bot.
- It carries an mtime cache so repeated reads cost a single stat syscall.
- The chokidar watcher in `lib/watch.ts` only fires `LiveRefresh` for files in the registry — a parser reading a path the registry doesn't know about will silently miss live updates.

If you add a new memory file:

1. Register it in `MEMORY_FILE_SCOPE` (`lib/memoryPath.ts`) as `shared` or `per-bot`.
2. Read it via `readMemory("FILE.md", ctx)` (with `ctx` for per-bot files).
3. Routines must write to the same resolved path — `memory/shared/FILE.md` or `memory/$BOT_ID/$STRATEGY/FILE.md`.

The `parsersUseRegistry.test.ts` lint test fails CI if any file under `lib/parsers/` imports `fs` directly or references `BOT_ROOT`. To allow-list a writer (e.g. `economicCalendarWriter.ts`), add it to `PARSERS_ALLOWED_TO_TOUCH_FS_DIRECTLY` in that test with a written justification.

## Tests

```bash
pnpm test         # one-shot run (CI mode)
pnpm test:watch   # watch mode
pnpm typecheck    # tsc --noEmit
pnpm build        # full Next.js build (catches Server Component issues)
```

CI runs all four on every push. Unit tests live alongside the code at `lib/**/__tests__/*.test.ts`. Pure logic gets pure tests — extract pure helpers out of hooks (see `lib/mascot/moodLogic.ts` for the pattern) rather than spinning up React Testing Library when you don't need it.

Hermetic FS tests use a tmpdir + `process.chdir` BEFORE the import so `memoryPath.ts`'s ROOT computation captures the tmp tree. See `lib/__tests__/memoryPath.test.ts` for the template.
