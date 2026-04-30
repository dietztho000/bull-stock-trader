import { readMemory } from "../memoryPath";
import { parseMdTable } from "./parseMdTable";
import { parseMoney, parsePercent, isPlaceholder } from "./numbers";

export type BenchmarkRow = {
  date: string;
  portfolio: number | null;
  dayPct: number | null;
  phasePct: number | null;
  spyClose: number | null;
  spyDayPct: number | null;
  spyPhasePct: number | null;
  alphaDay: number | null;
  alphaPhase: number | null;
};

export type BenchmarkData = {
  phaseStart: string | null;
  startingEquity: number | null;
  rows: BenchmarkRow[];
};

export async function loadBenchmark(): Promise<BenchmarkData> {
  const content = await readMemory("BENCHMARK.md");
  const phaseStart =
    content.match(/Phase start:\s*(\S+)/)?.[1]?.replace(/[*_`]/g, "") ?? null;
  const startingEquity = parseMoney(
    content.match(/Starting equity:\s*([^\n]+)/)?.[1]
  );

  const rows = parseMdTable(content, { heading: /^##\s+Daily rows/i })
    .filter((r) => !isPlaceholder(r) && r["Date"])
    .map<BenchmarkRow>((r) => ({
      date: r["Date"],
      portfolio: parseMoney(r["Portfolio"]),
      dayPct: parsePercent(r["Day %"]),
      phasePct: parsePercent(r["Phase %"]),
      spyClose: parseMoney(r["SPY close"]),
      spyDayPct: parsePercent(r["SPY day %"]),
      spyPhasePct: parsePercent(r["SPY phase %"]),
      alphaDay: parsePercent(r["Alpha day"]),
      alphaPhase: parsePercent(r["Alpha phase"]),
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return { phaseStart, startingEquity, rows };
}
