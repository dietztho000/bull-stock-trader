// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { BullCharacter } from "../BullCharacter";

afterEach(() => {
  cleanup();
});

describe("BullCharacter", () => {
  it("renders a decorative div with role=img on the SVG", () => {
    const { container } = render(<BullCharacter mood="neutral" />);
    // Outer wrapper is aria-hidden so screen readers ignore it; inner SVG
    // exposes role=img for graphical alternative-text fallback.
    expect(container.querySelector("[aria-hidden='true']")).not.toBeNull();
    expect(container.querySelector("svg[role='img']")).not.toBeNull();
  });

  it("renders 🎉 above head for celebrating mood", () => {
    const { container } = render(<BullCharacter mood="celebrating" />);
    expect(container.textContent ?? "").toContain("🎉");
  });

  it("renders ⛈️ for bearish mood", () => {
    const { container } = render(<BullCharacter mood="bearish" />);
    expect(container.textContent ?? "").toContain("⛈️");
  });

  it("renders 👍 for bullish mood", () => {
    const { container } = render(<BullCharacter mood="bullish" />);
    expect(container.textContent ?? "").toContain("👍");
  });

  it("renders no mood accessory for neutral mood", () => {
    const { container } = render(<BullCharacter mood="neutral" />);
    const text = container.textContent ?? "";
    expect(text).not.toContain("🎉");
    expect(text).not.toContain("⛈️");
    expect(text).not.toContain("👍");
  });

  it("renders the seasonal accessory emoji when set", () => {
    const { container } = render(
      <BullCharacter mood="neutral" seasonal="halloween" />
    );
    expect(container.textContent ?? "").toContain("🎃");
  });

  it("shows a 💛 overlay when idleGesture='happy'", () => {
    const { container } = render(
      <BullCharacter mood="neutral" idleGesture="happy" />
    );
    expect(container.textContent ?? "").toContain("💛");
  });

  it("does not show 💛 for idleGesture=null", () => {
    const { container } = render(
      <BullCharacter mood="neutral" idleGesture={null} />
    );
    expect(container.textContent ?? "").not.toContain("💛");
  });

  it("sizes the wrapper element to the requested size in pixels", () => {
    const { container, rerender } = render(<BullCharacter mood="neutral" size="sm" />);
    const wrapper = container.firstElementChild as HTMLElement;
    // happy-dom returns inline styles as strings.
    expect(wrapper.style.width).toBe("56px");
    rerender(<BullCharacter mood="neutral" size="lg" />);
    const wrapperLg = container.firstElementChild as HTMLElement;
    expect(wrapperLg.style.width).toBe("220px");
  });

  it("renders the tie SVG only at size md and lg, not sm", () => {
    const { container, rerender } = render(<BullCharacter mood="bullish" size="sm" />);
    const svgsSm = container.querySelectorAll("svg").length;

    rerender(<BullCharacter mood="bullish" size="md" />);
    const svgsMd = container.querySelectorAll("svg").length;

    expect(svgsMd).toBeGreaterThan(svgsSm);
  });
});
