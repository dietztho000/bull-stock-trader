// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RoutineHealthPopover } from "../RoutineHealthPopover";

afterEach(() => {
  cleanup();
});

const TODAY = "2026-05-05";

const ALL_FIRED = [
  "auth-canary",
  "pre-market",
  "market-open",
  "mid-morning",
  "late-morning",
  "midday",
  "stops",
  "afternoon",
  "daily-summary",
].map((routine, i) => ({
  routine,
  startTs: `2026-05-05T${String(8 + i).padStart(2, "0")}:00:00Z`,
  endTs: `2026-05-05T${String(8 + i).padStart(2, "0")}:01:00Z`,
  status: "ok" as const,
}));

describe("RoutineHealthPopover", () => {
  it("renders 'Routines: never' when latestTs is null", () => {
    render(<RoutineHealthPopover latestTs={null} routines={[]} todayCT={TODAY} />);
    expect(screen.getByText(/never/i)).toBeDefined();
  });

  it("shows the fired/total count and relative time when there's a latest entry", () => {
    const latestTs = Date.now() - 30 * 60_000; // 30 min ago
    render(
      <RoutineHealthPopover
        latestTs={latestTs}
        routines={ALL_FIRED}
        todayCT={TODAY}
      />
    );
    // Label like "Routines 9/9 · 30m"
    expect(screen.getByRole("button").textContent).toMatch(/Routines 9\/9/);
  });

  it("does not render the popover panel before the trigger is clicked", () => {
    render(<RoutineHealthPopover latestTs={Date.now()} routines={ALL_FIRED} todayCT={TODAY} />);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("opens the popover with one row per routine on click", async () => {
    const user = userEvent.setup();
    render(<RoutineHealthPopover latestTs={Date.now()} routines={ALL_FIRED} todayCT={TODAY} />);
    await user.click(screen.getByRole("button"));
    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeDefined();
    expect(dialog.textContent).toContain("auth-canary");
    expect(dialog.textContent).toContain("pre-market");
    expect(dialog.textContent).toContain("daily-summary");
  });

  it("surfaces 'missing' count when at least one expected routine never fired", async () => {
    const user = userEvent.setup();
    const partial = [
      {
        routine: "auth-canary",
        startTs: "2026-05-05T08:00:00Z",
        endTs: "2026-05-05T08:01:00Z",
        status: "ok" as const,
      },
      {
        routine: "pre-market",
        startTs: null,
        endTs: null,
        status: "missing" as const,
      },
      {
        routine: "midday",
        startTs: null,
        endTs: null,
        status: "missing" as const,
      },
    ];
    render(<RoutineHealthPopover latestTs={Date.now()} routines={partial} todayCT={TODAY} />);
    await user.click(screen.getByRole("button"));
    expect(screen.getByText(/2 missing/)).toBeDefined();
  });

  it("surfaces 'errored' count when at least one expected routine ended in error", async () => {
    const user = userEvent.setup();
    const errored = [
      {
        routine: "auth-canary",
        startTs: "2026-05-05T08:00:00Z",
        endTs: "2026-05-05T08:01:00Z",
        status: "error" as const,
      },
    ];
    render(<RoutineHealthPopover latestTs={Date.now()} routines={errored} todayCT={TODAY} />);
    await user.click(screen.getByRole("button"));
    expect(screen.getByText(/1 errored/)).toBeDefined();
  });

  it("closes the popover when Escape is pressed", async () => {
    const user = userEvent.setup();
    render(<RoutineHealthPopover latestTs={Date.now()} routines={ALL_FIRED} todayCT={TODAY} />);
    await user.click(screen.getByRole("button"));
    expect(screen.getByRole("dialog")).toBeDefined();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("toggles closed when the trigger is clicked again", async () => {
    const user = userEvent.setup();
    render(<RoutineHealthPopover latestTs={Date.now()} routines={ALL_FIRED} todayCT={TODAY} />);
    const trigger = screen.getByRole("button");
    await user.click(trigger);
    expect(screen.getByRole("dialog")).toBeDefined();
    await user.click(trigger);
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
