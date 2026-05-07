// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { PerplexityCostTile } from "../PerplexityCostTile";
import type { PerplexitySummary } from "@/lib/parsers/perplexityLog";

afterEach(() => {
  cleanup();
});

function buildSummary(overrides: Partial<PerplexitySummary> = {}): PerplexitySummary {
  return {
    rows: [],
    todayCount: 0,
    yesterdayCount: 0,
    todayCost: 0,
    rolling14dMedian: 0,
    perDay: [],
    lastEntryDate: null,
    lastEntryAt: null,
    ...overrides,
  };
}

describe("PerplexityCostTile", () => {
  it("renders today's count and cost", () => {
    render(
      <PerplexityCostTile
        summary={buildSummary({
          todayCount: 149,
          todayCost: 0.0745,
          yesterdayCount: 16,
          rolling14dMedian: 8,
        })}
      />
    );
    expect(screen.getByText(/Research API spend/i)).toBeDefined();
    expect(screen.getByText(/149 calls today/)).toBeDefined();
    expect(screen.getByText(/14d median/i)).toBeDefined();
  });

  it("shows the spike marker when today > 2x median", () => {
    render(
      <PerplexityCostTile
        summary={buildSummary({
          todayCount: 100,
          rolling14dMedian: 10,
        })}
      />
    );
    expect(screen.getByText(/spike/i)).toBeDefined();
  });

  it("does NOT show spike marker on a fresh install (median=0)", () => {
    render(
      <PerplexityCostTile
        summary={buildSummary({
          todayCount: 5,
          rolling14dMedian: 0,
        })}
      />
    );
    expect(screen.queryByText(/spike/i)).toBeNull();
  });

  it('renders "$0.00" and singular "1 call" when only one row hit today', () => {
    render(
      <PerplexityCostTile
        summary={buildSummary({ todayCount: 1, todayCost: 0.0005 })}
      />
    );
    expect(screen.getByText(/1 call today/)).toBeDefined();
  });
});
