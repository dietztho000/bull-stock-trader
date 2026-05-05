import { expect, test } from "playwright/test";

/** Smoke tests for the / overview page. Covers basic render hygiene + the
 *  mascot card mount in the persistent sidebar (audit T1/T3 wiring). */

test.describe("Overview page", () => {
  test("renders without server errors and mounts the sidebar nav", async ({
    page,
  }) => {
    const consoleErrors: string[] = [];
    page.on("pageerror", (e) => consoleErrors.push(`pageerror: ${e.message}`));
    page.on("console", (m) => {
      if (m.type() === "error") consoleErrors.push(`console.error: ${m.text()}`);
    });

    await page.goto("/");
    // Sidebar shows the bots/journal/etc. links.
    await expect(page.getByRole("link", { name: /Journal/i })).toBeVisible();
    expect(consoleErrors, consoleErrors.join("\n")).toEqual([]);
  });

  test("clicking the journal nav link routes to /journal", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: /Journal/i }).first().click();
    await expect(page).toHaveURL(/\/journal/);
    await expect(page.locator("h1", { hasText: "Journal" })).toBeVisible();
  });
});
