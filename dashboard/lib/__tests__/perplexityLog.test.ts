import { describe, expect, it } from "vitest";
import {
  PERPLEXITY_COST_PER_CALL,
  parsePerplexityLog,
  summarizePerplexity,
} from "../parsers/perplexityLog";

const HEADER = `# Perplexity Query Log

Append-only log of every Perplexity API call. Daily-summary tallies the
| Date | Model | Prompt |
| --- | --- | --- |
`;

describe("parsePerplexityLog", () => {
  it("returns [] for empty content", () => {
    expect(parsePerplexityLog("")).toEqual([]);
  });

  it("extracts the date prefix from rows regardless of TZ suffix (UTC, CDT, CT)", () => {
    const raw =
      HEADER +
      "| 2026-05-05 11:06 UTC | sonar | hello |\n" +
      "| 2026-05-06 18:58 CDT | sonar | world |\n" +
      "| 2026-05-07 09:15 CT  | sonar | another |\n";
    const rows = parsePerplexityLog(raw);
    expect(rows).toHaveLength(3);
    expect(rows.map((r) => r.date)).toEqual([
      "2026-05-05",
      "2026-05-06",
      "2026-05-07",
    ]);
  });

  it("flags cached rows via the model column", () => {
    const raw =
      HEADER +
      "| 2026-05-06 12:00 CT | sonar | fresh |\n" +
      "| 2026-05-06 12:00 CT | sonar (cached) | replay |\n";
    const rows = parsePerplexityLog(raw);
    expect(rows[0].isCached).toBe(false);
    expect(rows[1].isCached).toBe(true);
  });

  it("ignores header rows and prose lines", () => {
    const raw =
      HEADER +
      "| Date | Model | Prompt |\n" +
      "Some narrative explanation.\n" +
      "| 2026-05-06 12:00 CT | sonar | real row |\n";
    const rows = parsePerplexityLog(raw);
    expect(rows).toHaveLength(1);
    expect(rows[0].date).toBe("2026-05-06");
  });
});

describe("summarizePerplexity", () => {
  it("counts today/yesterday by CT date", () => {
    const today = "2026-05-07";
    const rows = [
      { date: "2026-05-05", isCached: false },
      { date: "2026-05-06", isCached: false },
      { date: "2026-05-06", isCached: false },
      { date: "2026-05-06", isCached: true },
      { date: "2026-05-07", isCached: false },
      { date: "2026-05-07", isCached: false },
    ];
    const s = summarizePerplexity(rows, today);
    expect(s.todayCount).toBe(2);
    expect(s.yesterdayCount).toBe(3);
    expect(s.todayCost).toBeCloseTo(2 * PERPLEXITY_COST_PER_CALL, 6);
  });

  it("computes 14-day rolling median of prior days (excludes today)", () => {
    const today = "2026-05-15";
    const rows: { date: string; isCached: boolean }[] = [];
    // 14 prior CT days with counts: 1..14 (median of 1..14 = 7.5)
    for (let i = 1; i <= 14; i++) {
      const d = new Date(Date.UTC(2026, 4, 15));
      d.setUTCDate(d.getUTCDate() - i);
      const date = d.toISOString().slice(0, 10);
      for (let n = 0; n < i; n++) rows.push({ date, isCached: false });
    }
    // Plus 100 entries for today (must NOT bias the median).
    for (let n = 0; n < 100; n++) rows.push({ date: today, isCached: false });
    const s = summarizePerplexity(rows, today);
    expect(s.rolling14dMedian).toBe(7.5);
    expect(s.todayCount).toBe(100);
  });

  it("returns zeros for an empty log", () => {
    const s = summarizePerplexity([], "2026-05-07");
    expect(s.todayCount).toBe(0);
    expect(s.yesterdayCount).toBe(0);
    expect(s.todayCost).toBe(0);
    expect(s.rolling14dMedian).toBe(0);
    expect(s.lastEntryDate).toBeNull();
    expect(s.perDay).toHaveLength(14);
  });

  it("perDay is oldest → newest ending one day before today", () => {
    const today = "2026-05-15";
    const s = summarizePerplexity([], today);
    expect(s.perDay[0].date).toBe("2026-05-01");
    expect(s.perDay[13].date).toBe("2026-05-14");
  });

  it("tracks the most recent date seen across all rows", () => {
    const rows = [
      { date: "2026-05-01", isCached: false },
      { date: "2026-05-07", isCached: false },
      { date: "2026-05-03", isCached: false },
    ];
    const s = summarizePerplexity(rows, "2026-05-07");
    expect(s.lastEntryDate).toBe("2026-05-07");
  });
});
