import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import path from "node:path";

// Phase 4 of the multi-strategy upgrade: scripts/bots.sh list emits a
// 6th column with the bot's strategy params as compact JSON. The
// per-bot Discord identity change added a 7th column with the bot's
// human-readable name (consumed by routines/_cloud-header.md's BOT_NAME
// export and discord.sh's identity prefix). These tests guard the
// contract — IFS-tab collapse already bit us once on empty allocation,
// and the cloud routines depend on all 7 fields surviving the trip
// from jq → @tsv → bash `read`.
//
// Tests run against the live `memory/shared/dashboard-settings.json` —
// hermetic isn't worth the complexity here when the real registry is
// the only meaningful fixture (after the seed has run).

const REPO_ROOT = path.resolve(__dirname, "../../..");

function botsList(...args: string[]): string[] {
  const out = execFileSync(
    "bash",
    ["scripts/bots.sh", "list", ...args],
    { cwd: REPO_ROOT, encoding: "utf8" }
  );
  return out.split("\n").filter((line) => line.length > 0);
}

describe("scripts/bots.sh list — Phase 4 contract", () => {
  it("emits exactly 7 tab-separated fields per row", () => {
    const rows = botsList("--include-disabled");
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      const fields = row.split("\t");
      expect(fields).toHaveLength(7);
    }
  });

  it("emits a non-empty human-readable bot_name in the 7th field", () => {
    const rows = botsList("--include-disabled");
    for (const row of rows) {
      const fields = row.split("\t");
      const botId = fields[0];
      const botName = fields[6];
      // Falls back to bot id when the registry entry has no `name`.
      expect(botName).not.toBe("");
      expect(botName.length).toBeGreaterThanOrEqual(botId.length === 0 ? 1 : 1);
      // No embedded tabs/newlines — discord.sh prefix sanitization
      // assumes the column is single-line so the IFS-tab read stays
      // stable. (Sanitization happens in bots.sh via jq gsub.)
      expect(botName).not.toMatch(/[\t\n]/);
    }
  });

  it("emits the literal 'null' for empty allocation (avoids IFS-tab collapse)", () => {
    const rows = botsList("--include-disabled");
    const fieldGrid = rows.map((r) => r.split("\t"));
    // At least one bot in the live registry uses no allocation; if every
    // bot has a numeric allocation, this test stays passing — we only
    // guard against the collapse case.
    const allocations = fieldGrid.map((f) => f[3]);
    for (const a of allocations) {
      // Either "null" sentinel OR a numeric string. Empty string would
      // re-introduce the collapse bug.
      expect(a).not.toBe("");
      if (a !== "null") {
        expect(Number.isFinite(Number(a))).toBe(true);
      }
    }
  });

  it("emits a JSON array (or [] for unmanaged slugs) in the 6th field", () => {
    const rows = botsList("--include-disabled");
    for (const row of rows) {
      const fields = row.split("\t");
      const paramsField = fields[5];
      // Must parse cleanly. Either an empty array or an array of typed
      // params with the expected shape.
      const parsed = JSON.parse(paramsField);
      expect(Array.isArray(parsed)).toBe(true);
      for (const p of parsed) {
        expect(p).toHaveProperty("kind");
        expect(p).toHaveProperty("key");
        expect(p).toHaveProperty("label");
        expect(["number", "percent", "enum", "table"]).toContain(p.kind);
      }
    }
  });

  it("a bash read -r round-trip preserves all 7 fields", () => {
    // Crucial regression guard: feed one row back through bash `read` the
    // same way the cloud routines do, and confirm no field gets dropped
    // by IFS-tab collapse. Fails if anyone re-introduces empty allocation
    // or empty bot_name.
    const rows = botsList("--include-disabled");
    const firstRow = rows[0];
    const script = `
      IFS=$'\\t' read -r f1 f2 f3 f4 f5 f6 f7 <<< '${firstRow.replace(/'/g, "'\\''")}'
      echo "f1=\${#f1} f2=\${#f2} f3=\${#f3} f4=\${#f4} f5=\${#f5} f6=\${#f6} f7=\${#f7}"
    `;
    const out = execFileSync("bash", ["-c", script], { encoding: "utf8" }).trim();
    const lengths = Object.fromEntries(
      out.split(" ").map((kv) => {
        const [k, v] = kv.split("=");
        return [k, Number(v)];
      })
    );
    expect(lengths.f1).toBeGreaterThan(0); // bot id
    expect(lengths.f2).toBeGreaterThan(0); // account id
    expect(lengths.f3).toBeGreaterThan(0); // strategy slug
    expect(lengths.f4).toBeGreaterThan(0); // allocation (sentinel or number)
    expect(lengths.f5).toBeGreaterThan(0); // mode
    expect(lengths.f6).toBeGreaterThan(0); // params JSON (at least "[]")
    expect(lengths.f7).toBeGreaterThan(0); // bot_name (falls back to bot id)
  });
});

describe("scripts/_routine-header.sh — _routine_export_strategy_params", () => {
  it("exports STRATEGY_<KEY> env vars from the params JSON", () => {
    // Hermetic: synthesize a params JSON covering all 4 kinds so the test
    // is decoupled from whichever bot/strategy happens to be in the live
    // registry today. The earlier version of this test piped from
    // `bots.sh list` and broke whenever the first registry bot's strategy
    // changed (e.g. after a fresh-start reset).
    const paramsJson = JSON.stringify([
      { kind: "number", key: "SECTOR_CAP", label: "Max per sector", value: 3 },
      { kind: "number", key: "MAX_OPEN_POSITIONS", label: "Max open", value: 6 },
      { kind: "percent", key: "DAY_BREAKER_PCT", label: "Day breaker", value: -2, min: -20, max: 0 },
      { kind: "number", key: "ENTRY_SCORE_MIN", label: "Entry score floor", value: 7 },
      { kind: "enum", key: "TIMEFRAME", label: "Bar timeframe", value: "1h", options: ["15m", "1h", "1d"] },
      { kind: "table", key: "CONVICTION_TABLE", label: "Score → size", rows: [{ k: 7, v: 12 }, { k: 10, v: 20 }] },
    ]);

    const out = execFileSync(
      "bash",
      [
        "-c",
        `
          source scripts/_routine-header.sh
          export STRATEGY_PARAMS_JSON='${paramsJson}'
          _routine_export_strategy_params
          echo "SECTOR_CAP=\${STRATEGY_SECTOR_CAP:-MISSING}"
          echo "MAX_OPEN=\${STRATEGY_MAX_OPEN_POSITIONS:-MISSING}"
          echo "DAY_BREAKER=\${STRATEGY_DAY_BREAKER_PCT:-MISSING}"
          echo "ENTRY_SCORE_MIN=\${STRATEGY_ENTRY_SCORE_MIN:-MISSING}"
          echo "TIMEFRAME=\${STRATEGY_TIMEFRAME:-MISSING}"
          echo "TABLE=\${STRATEGY_CONVICTION_TABLE_JSON:-MISSING}"
        `,
      ],
      { cwd: REPO_ROOT, encoding: "utf8" }
    );
    const lines = Object.fromEntries(
      out
        .trim()
        .split("\n")
        .map((l) => {
          const i = l.indexOf("=");
          return [l.slice(0, i), l.slice(i + 1)];
        })
    );
    // Scalars: number → bare value
    expect(lines.SECTOR_CAP).toBe("3");
    expect(lines.MAX_OPEN).toBe("6");
    // Scalars: percent → bare value (preserves negative sign)
    expect(lines.DAY_BREAKER).toBe("-2");
    expect(lines.ENTRY_SCORE_MIN).toBe("7");
    // Scalars: enum → bare value (string)
    expect(lines.TIMEFRAME).toBe("1h");
    // Tables: rows → compact JSON in a _JSON-suffixed variable
    const table = JSON.parse(lines.TABLE);
    expect(Array.isArray(table)).toBe(true);
    expect(table[0]).toEqual({ k: 7, v: 12 });
    expect(table[1]).toEqual({ k: 10, v: 20 });
  });
});
