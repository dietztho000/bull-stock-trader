// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { EmptyState } from "../EmptyState";

afterEach(() => {
  cleanup();
});

describe("EmptyState", () => {
  it("renders title and reason", () => {
    render(<EmptyState title="No research yet" reason="Pre-market routine fills this." />);
    expect(screen.getByText("No research yet")).toBeDefined();
    expect(screen.getByText(/Pre-market routine fills this/)).toBeDefined();
  });

  it("includes a schedule line when provided", () => {
    render(
      <EmptyState
        title="No research yet"
        reason="Pre-market routine fills this."
        schedule="Next fire ~6 AM CT (Mon–Fri)"
      />
    );
    expect(screen.getByText(/Next fire ~6 AM CT/)).toBeDefined();
  });

  it("omits the schedule line entirely when not provided", () => {
    render(<EmptyState title="X" reason="Y" />);
    expect(screen.queryByText(/Next/)).toBeNull();
  });

  it("renders a single internal-link CTA when action is provided", () => {
    render(
      <EmptyState
        title="X"
        reason="Y"
        action={{ href: "/bots", label: "Configure a bot" }}
      />
    );
    const link = screen.getByRole("link", { name: /Configure a bot/ });
    expect(link.getAttribute("href")).toBe("/bots");
  });

  it("renders supplementary children when supplied", () => {
    render(
      <EmptyState title="X" reason="Y">
        <p data-testid="extra">A note</p>
      </EmptyState>
    );
    expect(screen.getByTestId("extra").textContent).toBe("A note");
  });

  it("renders title, reason, schedule, action, and children together", () => {
    render(
      <EmptyState
        title="No daily summaries yet"
        reason="The daily-summary routine writes a unified cross-bot recap."
        schedule="Next ~3:15 PM CT"
        action={{ href: "/bots", label: "Verify bots" }}
      >
        <p data-testid="extra">Extra context</p>
      </EmptyState>
    );
    expect(screen.getByText("No daily summaries yet")).toBeDefined();
    expect(screen.getByText(/cross-bot recap/)).toBeDefined();
    expect(screen.getByText(/3:15 PM CT/)).toBeDefined();
    expect(screen.getByRole("link", { name: /Verify bots/ })).toBeDefined();
    expect(screen.getByTestId("extra").textContent).toBe("Extra context");
  });
});
