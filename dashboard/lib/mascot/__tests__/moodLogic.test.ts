import { describe, expect, it } from "vitest";
import {
  advanceHysteresis,
  candidateMood,
  computeBreakers,
  enrichedFlavor,
  FLAVOR,
  pickFlavor,
  pickMoodFlavor,
  strategyFlavor,
  type StrategyStateLike,
  type StrategyThresholds,
} from "../moodLogic";

const STRATEGY: StrategyThresholds = {
  celebrateThresholdPct: 3,
  bullishThresholdPct: 0.5,
  bearishThresholdPct: -0.5,
  dayBreakerPct: -2,
  weekBreakerPct: -4,
};

const NO_FLAGS: StrategyStateLike = {
  earningsT2Held: [],
  sectorsAtCap: [],
  blockedSectors: [],
  cooldownSymbols: [],
  blockedIdeas: [],
};

describe("computeBreakers", () => {
  it("returns false/false on a flat day with no week start", () => {
    expect(computeBreakers({ dayPct: 0, equity: 10_000 }, STRATEGY, null)).toEqual({
      day: false,
      week: false,
    });
  });

  it("flags the day breaker at exactly the threshold (≤ inclusive)", () => {
    const b = computeBreakers({ dayPct: -2, equity: 10_000 }, STRATEGY, null);
    expect(b.day).toBe(true);
    expect(b.week).toBe(false);
  });

  it("flags the week breaker when equity is more than 4% below week start", () => {
    // weekStart 10500, equity 10000 → weekPct ≈ -4.76% → tripped
    const b = computeBreakers({ dayPct: 0, equity: 10_000 }, STRATEGY, 10_500);
    expect(b.day).toBe(false);
    expect(b.week).toBe(true);
  });

  it("does not flag week breaker when equity is above week start", () => {
    const b = computeBreakers({ dayPct: 0, equity: 10_500 }, STRATEGY, 10_000);
    expect(b.week).toBe(false);
  });

  it("ignores week breaker when weekStart is null or zero", () => {
    expect(computeBreakers({ dayPct: 0, equity: 9_000 }, STRATEGY, null).week).toBe(false);
    expect(computeBreakers({ dayPct: 0, equity: 9_000 }, STRATEGY, 0).week).toBe(false);
  });
});

describe("candidateMood", () => {
  const noBreaker = { day: false, week: false };

  it("picks celebrating when day P&L meets the celebrate threshold", () => {
    expect(
      candidateMood({ dayPct: 3.0, equity: 10_000 }, STRATEGY, noBreaker)
    ).toBe("celebrating");
    expect(
      candidateMood({ dayPct: 5.0, equity: 10_000 }, STRATEGY, noBreaker)
    ).toBe("celebrating");
  });

  it("picks bullish when day P&L is between bullish and celebrate", () => {
    expect(
      candidateMood({ dayPct: 1.0, equity: 10_000 }, STRATEGY, noBreaker)
    ).toBe("bullish");
  });

  it("picks neutral when day P&L is inside the dead zone", () => {
    expect(
      candidateMood({ dayPct: 0, equity: 10_000 }, STRATEGY, noBreaker)
    ).toBe("neutral");
    expect(
      candidateMood({ dayPct: 0.4, equity: 10_000 }, STRATEGY, noBreaker)
    ).toBe("neutral");
  });

  it("picks bearish when day P&L is below the bearish threshold", () => {
    expect(
      candidateMood({ dayPct: -1, equity: 10_000 }, STRATEGY, noBreaker)
    ).toBe("bearish");
  });

  it("forces bearish when the day breaker is active even on a green day", () => {
    expect(
      candidateMood(
        { dayPct: 5, equity: 10_000 },
        STRATEGY,
        { day: true, week: false }
      )
    ).toBe("bearish");
  });

  it("forces bearish when the week breaker is active", () => {
    expect(
      candidateMood(
        { dayPct: 1, equity: 10_000 },
        STRATEGY,
        { day: false, week: true }
      )
    ).toBe("bearish");
  });
});

describe("strategyFlavor", () => {
  const noBreaker = { day: false, week: false };

  it("returns null with no state", () => {
    expect(strategyFlavor(null, noBreaker)).toBeNull();
  });

  it("preempts everything when day breaker is active", () => {
    const flavor = strategyFlavor(NO_FLAGS, { day: true, week: false });
    expect(flavor).toContain("Day breaker tripped");
  });

  it("preempts everything when week breaker is active", () => {
    const flavor = strategyFlavor(NO_FLAGS, { day: false, week: true });
    expect(flavor).toContain("Week breaker");
  });

  it("surfaces earnings gate before sector caps and blocks", () => {
    const state: StrategyStateLike = {
      ...NO_FLAGS,
      earningsT2Held: [{ symbol: "AAPL", daysUntil: 1 }],
      sectorsAtCap: ["Technology"],
      cooldownSymbols: [{ symbol: "TSLA", daysRemaining: 2 }],
    };
    const flavor = strategyFlavor(state, noBreaker);
    expect(flavor).toContain("AAPL");
    expect(flavor).toContain("earnings gate");
  });

  it("formats earnings 'today' when daysUntil is 0", () => {
    const state: StrategyStateLike = {
      ...NO_FLAGS,
      earningsT2Held: [{ symbol: "MSFT", daysUntil: 0 }],
    };
    expect(strategyFlavor(state, noBreaker)).toContain("MSFT reports today");
  });

  it("falls through priority chain to cooldown symbols", () => {
    const state: StrategyStateLike = {
      ...NO_FLAGS,
      cooldownSymbols: [{ symbol: "NVDA", daysRemaining: 3 }],
    };
    expect(strategyFlavor(state, noBreaker)).toContain("NVDA re-entry unlocks in 3d");
  });
});

describe("enrichedFlavor", () => {
  const detail = (overrides = {}) => ({
    dayPct: 0,
    positionCount: 0,
    winningPositionCount: 0,
    deployed: 50,
    winStreak: 0,
    ...overrides,
  });

  it("celebrating: top-of-leaderboard line at 5%+", () => {
    expect(enrichedFlavor("celebrating", detail({ dayPct: 5.2 }))).toContain(
      "top of the leaderboard"
    );
  });

  it("celebrating: streak line takes priority over the 3% dayPct line", () => {
    const f = enrichedFlavor("celebrating", detail({ dayPct: 3.5, winStreak: 4 }));
    expect(f).toContain("4 green days running");
  });

  it("bullish: surfaces winners-running when 3+ of 3+ green", () => {
    const f = enrichedFlavor(
      "bullish",
      detail({ dayPct: 0.6, positionCount: 4, winningPositionCount: 3 })
    );
    expect(f).toContain("Running 3 of 4 green");
  });

  it("bearish: -2% gets the breaker line; -1% gets the patience line", () => {
    expect(enrichedFlavor("bearish", detail({ dayPct: -2 }))).toContain("breaker up");
    expect(enrichedFlavor("bearish", detail({ dayPct: -1 }))).toContain("patience");
  });

  it("neutral: 0 positions yields stalking-setups; 4+ yields full-slate", () => {
    expect(
      enrichedFlavor("neutral", detail({ positionCount: 0 }))
    ).toContain("stalking setups");
    expect(
      enrichedFlavor("neutral", detail({ positionCount: 4, deployed: 80 }))
    ).toContain("4 positions");
  });

  it("returns null when nothing notable", () => {
    expect(
      enrichedFlavor("neutral", detail({ positionCount: 3, deployed: 60 }))
    ).toBeNull();
  });
});

describe("pickFlavor (deterministic static fallback)", () => {
  it("returns the same line for the same (mood, dateKey) tuple", () => {
    expect(pickFlavor("neutral", "2026-05-05")).toBe(pickFlavor("neutral", "2026-05-05"));
  });

  it("can return different lines across days", () => {
    const seen = new Set<string>();
    for (const d of ["2026-05-01", "2026-05-02", "2026-05-03", "2026-05-04", "2026-05-05"]) {
      seen.add(pickFlavor("bullish", d));
    }
    // Pool size is 4 — at least 2 distinct lines across 5 days.
    expect(seen.size).toBeGreaterThan(1);
  });

  it("returns one of the static lines from the FLAVOR pool", () => {
    expect(FLAVOR.bullish).toContain(pickFlavor("bullish", "2026-05-05"));
  });
});

describe("pickMoodFlavor (cascade)", () => {
  const noBreaker = { day: false, week: false };
  const baseDetail = {
    dayPct: 0,
    positionCount: 2,
    winningPositionCount: 1,
    deployed: 60,
    winStreak: 0,
  };

  it("strategy flavor preempts enriched and static", () => {
    const state: StrategyStateLike = {
      ...NO_FLAGS,
      sectorsAtCap: ["Tech"],
    };
    const f = pickMoodFlavor("neutral", baseDetail, state, noBreaker, "2026-05-05");
    expect(f).toContain("Tech sector at cap");
  });

  it("enriched flavor used when strategy returns null", () => {
    const f = pickMoodFlavor(
      "celebrating",
      { ...baseDetail, dayPct: 6 },
      NO_FLAGS,
      noBreaker,
      "2026-05-05"
    );
    expect(f).toContain("top of the leaderboard");
  });

  it("static flavor used when both strategy and enriched return null", () => {
    const f = pickMoodFlavor("neutral", baseDetail, NO_FLAGS, noBreaker, "2026-05-05");
    expect(FLAVOR.neutral).toContain(f);
  });

  it("uses static flavor without strategy state", () => {
    const f = pickMoodFlavor("neutral", baseDetail, null, noBreaker, "2026-05-05");
    expect(FLAVOR.neutral).toContain(f);
  });
});

describe("advanceHysteresis", () => {
  it("does not flip when candidate equals committed", () => {
    const r = advanceHysteresis(
      "neutral",
      "neutral",
      { mood: "neutral", consecutive: 0 },
      2
    );
    expect(r.committed).toBe("neutral");
    expect(r.ref.consecutive).toBe(0);
  });

  it("requires N consecutive identical candidates before flipping", () => {
    let prev = { mood: "neutral" as const, consecutive: 0 };
    let r = advanceHysteresis("bullish", "neutral", prev, 2);
    expect(r.committed).toBe("neutral"); // first poll — wait
    expect(r.ref).toEqual({ mood: "bullish", consecutive: 1 });

    r = advanceHysteresis("bullish", "neutral", r.ref, 2);
    expect(r.committed).toBe("bullish"); // second poll — flip
  });

  it("resets consecutive counter when the candidate changes", () => {
    let r = advanceHysteresis(
      "bullish",
      "neutral",
      { mood: "neutral", consecutive: 0 },
      2
    );
    expect(r.ref.consecutive).toBe(1);

    r = advanceHysteresis("bearish", "neutral", r.ref, 2);
    expect(r.committed).toBe("neutral");
    expect(r.ref).toEqual({ mood: "bearish", consecutive: 1 });
  });

  it("flips immediately when requiredConsecutive is 1", () => {
    const r = advanceHysteresis(
      "celebrating",
      "neutral",
      { mood: "neutral", consecutive: 0 },
      1
    );
    expect(r.committed).toBe("celebrating");
  });
});
