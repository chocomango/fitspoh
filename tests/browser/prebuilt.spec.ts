import { test, expect } from "@playwright/test";

test("prebuilt plan installs once, has flexible rest days and preserves working targets", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("#plans");
  await page
    .getByRole("button", { name: "Add my prebuilt plan", exact: true })
    .click();
  await expect(page.locator(".day-grid .day-card:not(.add-day)")).toHaveCount(
    7,
  );
  await page
    .getByRole("button", { name: "Open my prebuilt plan", exact: true })
    .click();
  await expect(page.locator(".plan-tabs .chip")).toHaveCount(1);
  const upper = page.locator(".day-card").filter({
    has: page.getByRole("heading", { name: "Day 1 — Upper", exact: true }),
  });
  await upper.getByRole("button", { name: "Edit day" }).click();
  await expect(page.getByLabel("Set 1 weight").first()).toHaveValue("27.5");
  await expect(page.getByLabel("Set 1 weight").nth(2)).toHaveValue("63.75");
  await page.getByRole("button", { name: "Start", exact: true }).click();
  await page.getByRole("button", { name: "Start set", exact: true }).click();
  await expect(page.getByLabel("Weight (kg)", { exact: true })).toHaveValue(
    "27.5",
  );
  await expect(page.getByLabel("Reps", { exact: true })).toHaveValue("9");
  await page.getByRole("button", { name: "Overview", exact: true }).click();
  await expect(page.locator(".movement-card").last()).toContainText(
    "Skipped sets: 2",
  );
  await page.locator(".workout-summary").getByRole("button").last().click();
  await page.getByRole("button", { name: "Confirm", exact: true }).click();
  await page
    .locator(".mobile-nav")
    .getByRole("link", { name: "Plans", exact: true })
    .click();
  await page.getByRole("button", { name: "Back to plan" }).click();
  const rest = page.locator(".day-card").filter({
    has: page.getByRole("heading", {
      name: "Day 3 — Rest / activity",
      exact: true,
    }),
  });
  await rest.getByRole("button", { name: "Set as next workout" }).click();
  await page
    .locator(".mobile-nav")
    .getByRole("link", { name: "Home", exact: true })
    .click();
  await page
    .locator(".next-workout")
    .getByRole("button", { name: "Rest / activity", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Day 4 — Push", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Take extra rest", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Day 4 — Push", exact: true }),
  ).toBeVisible();
});

test("stack and per-side loads retain their conventions across units and backup", async ({
  page,
}) => {
  await page.goto("#plans");
  await page
    .getByRole("button", { name: "Add my prebuilt plan", exact: true })
    .click();
  await page
    .locator(".day-card")
    .filter({
      has: page.getByRole("heading", {
        name: "Day 2 — Lower · Strength",
        exact: true,
      }),
    })
    .getByRole("button", { name: "Start", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Skip exercise", exact: true })
    .click();
  await page.getByRole("button", { name: "Start set", exact: true }).click();
  await expect(
    page.getByLabel("Weight (kg per side)", { exact: true }),
  ).toHaveValue("40");
  await page.getByRole("button", { name: "Overview", exact: true }).click();
  await expect(page.locator(".movement-card").nth(2)).toContainText(
    "kg plates",
  );
  await page
    .locator(".sidebar")
    .getByRole("link", { name: "Settings", exact: true })
    .click();
  await page
    .getByRole("combobox", { name: "Weight unit", exact: true })
    .selectOption("lb");
  await page
    .locator(".sidebar")
    .getByRole("link", { name: "My plans", exact: true })
    .click();
  await page
    .locator(".day-card")
    .filter({
      has: page.getByRole("heading", { name: "Day 1 — Upper", exact: true }),
    })
    .getByRole("button", { name: "Edit day" })
    .click();
  await expect(page.getByLabel("Set 1 weight").nth(5)).toHaveValue("30");
  await expect(page.locator(".movement-card").nth(5)).toContainText(
    "stack setting",
  );
  await page
    .locator(".sidebar")
    .getByRole("link", { name: "Settings", exact: true })
    .click();
  const download = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Export full backup", exact: true })
    .click();
  await page
    .locator("input[type=file]")
    .setInputFiles((await (await download).path())!);
  await page
    .getByRole("button", { name: "Replace and restore", exact: true })
    .click();
  await expect(
    page.getByText("Backup restored", { exact: false }),
  ).toBeVisible();
});
