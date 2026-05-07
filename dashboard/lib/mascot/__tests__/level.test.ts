import { describe, expect, it } from "vitest";
import { LEVELS, levelFor } from "../level";

describe("levelFor", () => {
  it("returns null for nullish or non-finite phasePct", () => {
    expect(levelFor(null)).toBeNull();
    expect(levelFor(NaN)).toBeNull();
    expect(levelFor(Infinity)).toBeNull();
  });

  it("places +1.83% at Level 1 with finite progressPct (regression for NaN bug)", () => {
    const r = levelFor(1.83);
    expect(r).not.toBeNull();
    expect(r!.current.level).toBe(1);
    expect(r!.next?.level).toBe(2);
    expect(Number.isFinite(r!.progressPct)).toBe(true);
    expect(r!.progressPct).toBeGreaterThan(0);
    expect(r!.progressPct).toBeLessThanOrEqual(100);
    expect(r!.progressPct).toBeCloseTo(91.5, 0);
  });

  it("clamps a break-even bot (phasePct = 0) to 0% progress within Level 1", () => {
    const r = levelFor(0);
    expect(r!.current.level).toBe(1);
    expect(r!.progressPct).toBe(0);
  });

  it("clamps sub-zero phasePct to 0% progress (no negative-width bar)", () => {
    const r = levelFor(-5);
    expect(r!.current.level).toBe(1);
    expect(r!.progressPct).toBe(0);
  });

  it("transitions to Level 2 at the inclusive boundary (phasePct = 2)", () => {
    const r = levelFor(2);
    expect(r!.current.level).toBe(2);
    expect(r!.current.title).toBe("Scout");
    expect(r!.progressPct).toBe(0);
  });

  it("returns Level 10 (Legend) at +50% with progressPct = 100 and no next", () => {
    const r = levelFor(50);
    expect(r!.current.level).toBe(10);
    expect(r!.current.title).toBe("Legend");
    expect(r!.next).toBeNull();
    expect(r!.progressPct).toBe(100);
  });

  it("caps progressPct at 100 even above the top level", () => {
    const r = levelFor(999);
    expect(r!.current.level).toBe(10);
    expect(r!.progressPct).toBe(100);
  });

  it("computes mid-band progressPct correctly within Level 1 (0% → +2%)", () => {
    const r = levelFor(1);
    expect(r!.current.level).toBe(1);
    expect(r!.progressPct).toBe(50);
  });

  it("LEVELS table is sorted ascending by startsAt and contiguous via nextAt", () => {
    for (let i = 0; i < LEVELS.length - 1; i++) {
      expect(LEVELS[i].nextAt).toBe(LEVELS[i + 1].startsAt);
    }
    expect(LEVELS[LEVELS.length - 1].nextAt).toBeNull();
  });
});
