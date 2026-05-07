// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { HoverTooltip } from "../HoverTooltip";

afterEach(() => {
  cleanup();
});

describe("HoverTooltip", () => {
  it("does not render the tooltip until trigger is hovered", () => {
    render(
      <HoverTooltip content={<span>tip body</span>}>
        <button>trigger</button>
      </HoverTooltip>
    );
    expect(screen.queryByRole("tooltip")).toBeNull();
  });

  it("shows tooltip on mouse enter and hides on mouse leave", () => {
    render(
      <HoverTooltip content={<span>tip body</span>}>
        <button>trigger</button>
      </HoverTooltip>
    );
    const trigger = screen.getByRole("button");
    fireEvent.mouseEnter(trigger);
    expect(screen.getByRole("tooltip").textContent).toBe("tip body");
    fireEvent.mouseLeave(trigger);
    expect(screen.queryByRole("tooltip")).toBeNull();
  });

  it("shows tooltip on focus and hides on blur (a11y)", () => {
    render(
      <HoverTooltip content={<span>tip body</span>}>
        <button>trigger</button>
      </HoverTooltip>
    );
    const trigger = screen.getByRole("button");
    fireEvent.focus(trigger);
    expect(screen.getByRole("tooltip")).toBeDefined();
    fireEvent.blur(trigger);
    expect(screen.queryByRole("tooltip")).toBeNull();
  });

  it("wires aria-describedby when open and clears it when closed", () => {
    render(
      <HoverTooltip content={<span>tip body</span>}>
        <button>trigger</button>
      </HoverTooltip>
    );
    const trigger = screen.getByRole("button");
    expect(trigger.getAttribute("aria-describedby")).toBeNull();
    fireEvent.mouseEnter(trigger);
    const tooltipId = screen.getByRole("tooltip").id;
    expect(trigger.getAttribute("aria-describedby")).toBe(tooltipId);
    fireEvent.mouseLeave(trigger);
    expect(trigger.getAttribute("aria-describedby")).toBeNull();
  });

  it("renders structured JSX content (not just strings)", () => {
    render(
      <HoverTooltip
        content={
          <dl>
            <dt>Symbol</dt>
            <dd>NVDA</dd>
            <dt>EPS est</dt>
            <dd>$5.40</dd>
          </dl>
        }
      >
        <button>trigger</button>
      </HoverTooltip>
    );
    fireEvent.mouseEnter(screen.getByRole("button"));
    expect(screen.getByText("NVDA")).toBeDefined();
    expect(screen.getByText("$5.40")).toBeDefined();
  });
});
