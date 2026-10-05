import { test, expect } from "@playwright/test";

test("cozy theme persists, includes character artwork, and works with backups", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("");
  const toggle = page.getByRole("switch", { name: "Sumikko Gurashi theme" });
  await expect(toggle).toHaveAttribute("aria-checked", "false");
  await toggle.click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "sumikko");
  await expect(page.locator(".cozy-welcome .corner-friend")).toHaveCount(5);
  await expect(
    page.getByRole("heading", { name: "A little stronger, together." }),
  ).toBeVisible();
  await page.screenshot({ path: ".cache/mobile-sumikko.png", fullPage: true });
  await expect(page.getByText("Saved on this device").first()).toBeAttached();
  await page.reload();
  await expect(toggle).toHaveAttribute("aria-checked", "true");
  await page.locator(".mobile-nav").getByRole("link", { name: "More" }).click();
  await expect(
    page.getByRole("button", { name: "Sumikko Gurashi Soft & cozy" }),
  ).toHaveAttribute("aria-pressed", "true");
  const downloaded = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export full backup" }).click();
  const file = await (await downloaded).path();
  await toggle.click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "focus");
  await page.locator("input[type=file]").setInputFiles(file!);
  await page.getByRole("button", { name: "Replace and restore" }).click();
  await expect(toggle).toHaveAttribute("aria-checked", "true");
  await page
    .locator(".more-links")
    .getByRole("link", { name: "Exercise library" })
    .click();
  await page.getByRole("button", { name: "Exercise filters" }).click();
  await expect(
    page.getByRole("combobox", { name: "Muscle group" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Exercise filters" }).click();
  await expect(
    page.getByRole("combobox", { name: "Muscle group" }),
  ).toBeHidden();
  await page.screenshot({
    path: ".cache/mobile-sumikko-library.png",
    fullPage: true,
  });
});

test("mobile workout fields fit narrow screens and effort tracking remains usable", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto("#workout");
  await page.getByRole("button", { name: "Start empty workout" }).click();
  await page.getByRole("button", { name: "Add exercise", exact: true }).click();
  await page.getByLabel("Search exercises").fill("Barbell Curl");
  await page
    .locator(".library-modal .exercise-card")
    .filter({
      has: page.getByRole("button", { name: "Barbell Curl", exact: true }),
    })
    .getByRole("button", { name: "Add exercise", exact: true })
    .click();
  await expect(page.getByLabel("Set 1 weight")).toBeVisible();
  await page.getByLabel("Set 1 weight").fill("20");
  await page.getByLabel("Set 1 reps").fill("10");
  await page.getByRole("button", { name: "Complete set 1" }).click();
  await page.locator(".mobile-nav").getByRole("link", { name: "More" }).click();
  await page
    .getByRole("combobox", { name: "Optional effort tracking", exact: true })
    .selectOption("RIR");
  await page
    .locator(".mobile-nav")
    .getByRole("link", { name: "Train" })
    .click();
  await page.getByLabel("Set 1 effort").fill("2");
  for (const theme of ["focus", "sumikko"]) {
    if (theme === "sumikko")
      await page.getByRole("switch", { name: "Sumikko Gurashi theme" }).click();
    for (const width of [320, 390, 430]) {
      await page.setViewportSize({ width, height: 844 });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBeTruthy();
      expect(
        await page
          .locator(".set-table")
          .evaluate((el) => el.scrollWidth <= el.clientWidth),
      ).toBeTruthy();
      const box = await page
        .getByRole("button", { name: "Complete set 1" })
        .boundingBox();
      expect(box!.width).toBeGreaterThanOrEqual(44);
      expect(box!.height).toBeGreaterThanOrEqual(44);
    }
    await page.screenshot({
      path: `.cache/mobile-workout-${theme}.png`,
      fullPage: true,
    });
  }
  await page.getByRole("button", { name: "Finish workout" }).click();
  await page.getByRole("button", { name: "Confirm", exact: true }).click();
  await expect(page.locator(".history-card")).toHaveCount(1);
});
