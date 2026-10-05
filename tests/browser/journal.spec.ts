import { test, expect } from "@playwright/test";
test("plans, workouts, body stats, backups, and offline recovery on GitHub Pages subpath", async ({
  page,
  context,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("");
  await expect(page.getByText("Saved on this device").first()).toBeVisible();
  await page.screenshot({
    path: ".cache/desktop-overview.png",
    fullPage: true,
  });
  await page
    .locator(".sidebar")
    .getByRole("link", { name: "My plans" })
    .click();
  await page.getByRole("button", { name: "New plan", exact: true }).click();
  await page.getByLabel("Name", { exact: true }).fill("Upper / Lower");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await page
    .getByRole("button", { name: "Add workout day", exact: false })
    .click();
  await page.getByLabel("Name", { exact: true }).fill("Upper A");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await page.getByRole("button", { name: "Add exercise to Upper A" }).click();
  await page.getByLabel("Search exercises").fill("Dumbbell Bench Press");
  await page
    .locator(".library-modal .exercise-card")
    .filter({
      has: page.getByRole("button", {
        name: "Dumbbell Bench Press",
        exact: true,
      }),
    })
    .getByRole("button", { name: "Add exercise", exact: true })
    .click();
  await page.getByLabel("Set 1 weight").fill("20");
  await page.getByLabel("Set 1 reps").fill("12");
  await page.getByRole("button", { name: "Start", exact: true }).click();
  await page.getByRole("button", { name: "Complete set 1" }).click();
  await expect(page.locator(".set-check.checked")).toHaveCount(1);
  await page.getByLabel("Workout notes").fill("Good session");
  await page.screenshot({ path: ".cache/workout.png", fullPage: true });
  await expect(page.getByText("Saved on this device").first()).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Set 1 weight")).toHaveValue("20");
  await expect(page.locator(".set-check.checked")).toHaveCount(1);
  await page.getByRole("button", { name: "Finish workout" }).click();
  await page.getByRole("button", { name: "Confirm", exact: true }).click();
  await expect(page.locator(".history-card")).toHaveCount(1);
  await page
    .locator(".sidebar")
    .getByRole("link", { name: "Body progress" })
    .click();
  await page.getByRole("button", { name: "Log body stats" }).click();
  await page.getByLabel("Weight (kg)", { exact: true }).fill("75.5");
  await page.getByLabel("Waist (cm)", { exact: true }).fill("85");
  await page.getByRole("button", { name: "Save entry" }).click();
  await expect(page.locator(".body-row")).toHaveCount(1);
  await page
    .locator(".sidebar")
    .getByRole("link", { name: "Settings", exact: true })
    .click();
  await page
    .getByRole("combobox", { name: "Weight unit", exact: true })
    .selectOption("lb");
  await page
    .getByRole("combobox", { name: "Body measurement unit", exact: true })
    .selectOption("in");
  await page
    .locator(".sidebar")
    .getByRole("link", { name: "Body progress" })
    .click();
  await expect(page.locator(".body-values")).toContainText("166.4 lb");
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await expect(page.getByLabel("Weight (lb)", { exact: true })).toHaveValue(
    "166.45",
  );
  await page.getByRole("button", { name: "Close body entry" }).click();
  await page
    .locator(".sidebar")
    .getByRole("link", { name: "Settings", exact: true })
    .click();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export full backup" }).click();
  const backup = await downloadPromise;
  const file = await backup.path();
  await page.locator("input[type=file]").setInputFiles(file!);
  await expect(page.getByText("Restore your journal?")).toBeVisible();
  await page.getByRole("button", { name: "Replace and restore" }).click();
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
  await context.setOffline(true);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Settings", exact: true }),
  ).toBeVisible();
  await page
    .locator(".sidebar")
    .getByRole("link", { name: "Body progress" })
    .click();
  await expect(page.locator(".body-row")).toHaveCount(1);
  await context.setOffline(false);
  expect(errors).toEqual([]);
});
test("mobile layout, equipment filtering, and animated guide", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("");
  await page.locator(".mobile-nav").getByRole("link", { name: "More" }).click();
  await page
    .locator(".more-links")
    .getByRole("link", { name: "Exercise library" })
    .click();
  await page.getByLabel("Search exercises").fill("Barbell Curl");
  await page.getByRole("button", { name: "Barbell Curl", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Barbell Curl", exact: true, level: 2 }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Pause", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Close exercise guide" }).click();
  await page.screenshot({ path: ".cache/mobile-library.png", fullPage: true });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
  await page.goto("#equipment");
  const eq = page.locator(".equipment-card").filter({
    has: page.getByRole("heading", { name: "Dumbbells", exact: true }),
  });
  await eq.getByLabel("I have seen this equipment").check();
  await eq.getByRole("button", { name: "See exercises" }).click();
  await page.getByLabel("Search exercises").fill("Dumbbell Bench Press");
  await page.getByRole("button", { name: "Available at my gym" }).click();
  await expect(page.getByText("No matching exercises")).toBeVisible();
  await page.goto("#equipment");
  await page
    .locator(".equipment-card")
    .filter({
      has: page.getByRole("heading", { name: "Adjustable bench", exact: true }),
    })
    .getByLabel("I have seen this equipment")
    .check();
  await page.goto("#library");
  await expect(
    page.getByRole("button", { name: "Dumbbell Bench Press", exact: true }),
  ).toBeVisible();
});
test("invalid import leaves existing records untouched", async ({ page }) => {
  await page.goto("#settings");
  await page.locator("input[type=file]").setInputFiles({
    name: "bad.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify({ version: 1, plans: [] })),
  });
  await expect(page.getByRole("status")).toContainText("Missing");
  await expect(page.getByText("Restore your journal?")).toHaveCount(0);
});
test("unreadable stored data is preserved instead of overwritten", async ({
  page,
}) => {
  await page.goto("");
  await expect(page.getByText("Saved on this device").first()).toBeVisible();
  await page.evaluate(async () => {
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open("fitspoh", 1);
      request.onsuccess = () => {
        const db = request.result,
          tx = db.transaction("journal", "readwrite");
        tx.objectStore("journal").put(
          { version: 99, important: "keep this" },
          "state",
        );
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onerror = () => reject(tx.error);
      };
      request.onerror = () => reject(request.error);
    });
  });
  await page.reload();
  await expect(page.locator(".storage-status")).toContainText(
    "existing records have not been overwritten",
  );
  const version = await page.evaluate(
    async () =>
      await new Promise<number>((resolve) => {
        const r = indexedDB.open("fitspoh", 1);
        r.onsuccess = () => {
          const db = r.result,
            q = db.transaction("journal").objectStore("journal").get("state");
          q.onsuccess = () => {
            resolve(q.result.version);
            db.close();
          };
        };
      }),
  );
  expect(version).toBe(99);
});
