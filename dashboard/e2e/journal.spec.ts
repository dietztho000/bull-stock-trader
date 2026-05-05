import { expect, test } from "playwright/test";

/** Smoke tests for the Journal page — covers the audit B drill-down
 *  popover, the audit E empty states, and basic page render hygiene. */

test.describe("Journal page", () => {
  test("renders without server errors and shows the routine-health badge", async ({
    page,
  }) => {
    const consoleErrors: string[] = [];
    page.on("pageerror", (e) => consoleErrors.push(`pageerror: ${e.message}`));
    page.on("console", (m) => {
      if (m.type() === "error") consoleErrors.push(`console.error: ${m.text()}`);
    });

    await page.goto("/journal");
    await expect(page.locator("h1", { hasText: "Journal" })).toBeVisible();
    // The routine-health badge is the trigger button — its label always
    // includes either "Routines" or "never".
    await expect(
      page.getByRole("button", { name: /Routines|never/i })
    ).toBeVisible();

    expect(consoleErrors, consoleErrors.join("\n")).toEqual([]);
  });

  test("opens the per-routine drill-down popover on click", async ({ page }) => {
    await page.goto("/journal");
    const trigger = page.getByRole("button", { name: /Routines|never/i });
    await trigger.click();
    const dialog = page.getByRole("dialog", { name: /routine health/i });
    await expect(dialog).toBeVisible();
    // Each expected daily routine should have a row in the popover.
    for (const routine of ["auth-canary", "pre-market", "midday", "daily-summary"]) {
      await expect(dialog.getByText(routine, { exact: false })).toBeVisible();
    }
  });

  test("Daily tab — empty state renders with the standardized component when no summaries exist", async ({
    page,
  }) => {
    await page.goto("/journal?tab=daily");
    // Either a real entry or the standardized empty state — guard so this
    // smoke test passes regardless of memory/ contents.
    const empty = page.getByText("No daily summaries yet");
    if (await empty.isVisible().catch(() => false)) {
      // The empty state advertises the next fire window + a link to /bots.
      await expect(page.getByText(/3:15 PM CT/)).toBeVisible();
      await expect(
        page.getByRole("link", { name: /Verify enabled bots/i })
      ).toBeVisible();
    }
  });

  test("Routines tab navigates from URL and renders the cross-bot grid", async ({
    page,
  }) => {
    await page.goto("/journal?tab=routines");
    // CrossBotRoutineGrid mounts a Refresh button on the routines tab.
    await expect(
      page.getByRole("button", { name: /refresh/i })
    ).toBeVisible({ timeout: 10_000 });
  });
});
