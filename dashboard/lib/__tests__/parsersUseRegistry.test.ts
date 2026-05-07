import { describe, expect, it } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";

const PARSER_DIR = path.resolve(__dirname, "..", "parsers");

/** Files in the parsers directory that are allowed to import fs/path
 *  directly. The DAILY-SUMMARY orphan happened because dailySummary.ts
 *  built its own path off BOT_ROOT and bypassed the registry. The static
 *  guard below blocks that pattern at PR review by failing this test
 *  whenever a parser regresses. Audit A — parser-registry guard. */
const PARSERS_ALLOWED_TO_TOUCH_FS_DIRECTLY = new Set<string>([
  // Writers, not readers. They mutate memory/ files (atomically) and live
  // here for proximity to the parser sibling rather than as a "parser"
  // per se. The registry guard is about read-path bypasses; writes already
  // route through resolveMemoryFile.
  "economicCalendarWriter.ts",
  "marketEarningsWriter.ts",
  // watchlist.ts bundles a parser AND a writer because the file is small
  // and only one /api route + one routine touches it. The reader path uses
  // readMemory(); the writer (addToWatchlist / removeFromWatchlist) uses
  // resolveMemoryFile + fs.writeFile in the same module.
  "watchlist.ts",
]);

async function listParserFiles(): Promise<string[]> {
  const entries = await fs.readdir(PARSER_DIR);
  return entries.filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts"));
}

describe("parsers route memory IO through readMemory()", () => {
  it("none of the parsers import fs directly", async () => {
    const offenders: string[] = [];
    for (const file of await listParserFiles()) {
      if (PARSERS_ALLOWED_TO_TOUCH_FS_DIRECTLY.has(file)) continue;
      const src = await fs.readFile(path.join(PARSER_DIR, file), "utf8");
      // Either form: `from "node:fs"`, `from "fs"`, `require("fs")`.
      if (
        /from\s+["']node:fs[^"']*["']/.test(src) ||
        /from\s+["']fs[^"']*["']/.test(src) ||
        /require\(\s*["']node:fs[^"']*["']\s*\)/.test(src) ||
        /require\(\s*["']fs[^"']*["']\s*\)/.test(src)
      ) {
        offenders.push(file);
      }
    }
    expect(
      offenders,
      `These parsers import fs directly instead of going through readMemory():
${offenders.map((f) => `  - ${f}`).join("\n")}

If you need fs for a non-memory purpose, add the file to PARSERS_ALLOWED_TO_TOUCH_FS_DIRECTLY in this test with a written justification. Otherwise, switch to readMemory(file, ctx) so the file goes through MEMORY_FILE_SCOPE and the chokidar watcher.`
    ).toEqual([]);
  });

  it("none of the parsers reference BOT_ROOT (project-root file paths)", async () => {
    const offenders: string[] = [];
    for (const file of await listParserFiles()) {
      if (PARSERS_ALLOWED_TO_TOUCH_FS_DIRECTLY.has(file)) continue;
      const src = await fs.readFile(path.join(PARSER_DIR, file), "utf8");
      if (/\bBOT_ROOT\b/.test(src)) offenders.push(file);
    }
    expect(
      offenders,
      `These parsers still reference BOT_ROOT, which puts files outside memory/ and bypasses the chokidar watcher (audit F2).
${offenders.map((f) => `  - ${f}`).join("\n")}`
    ).toEqual([]);
  });
});
