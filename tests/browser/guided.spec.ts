import { test, expect, type Page } from "@playwright/test";

async function reloadSaved(page: Page) {
  await expect(page.locator(".storage-status")).toContainText(
    "Saved on this device",
  );
  await page.reload();
}

// Hold a real transaction ahead of automatic saves to exercise slow storage.
async function delayJournalWrites(page: Page) {
  await expect(page.locator(".storage-status")).toContainText(
    "Saved on this device",
  );
  await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("fitspoh", 1);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const tx = db.transaction("journal", "readwrite");
    const store = tx.objectStore("journal");
    const until = performance.now() + 1000;
    const keepBusy = () => {
      const request = store.get("revision");
      request.onsuccess = () => {
        if (performance.now() < until) keepBusy();
      };
    };
    tx.oncomplete = () => db.close();
    tx.onabort = () => db.close();
    keepBusy();
  });
}

test("extra guided sets preserve set three and run before the next exercise", async ({
  page,
}) => {
  await seed(page);
  await page.getByRole("button", { name: "Start", exact: true }).click();
  await page.getByRole("button", { name: "Start set", exact: true }).click();
  for (let i = 0; i < 2; i++) {
    await page
      .getByRole("button", { name: "Complete set & start rest" })
      .click();
    await page
      .getByRole("button", { name: /Skip rest|Start next set/ })
      .click();
  }
  await page.getByLabel("Weight (kg)", { exact: true }).fill("30");
  await page.getByLabel("Reps", { exact: true }).fill("9");
  await page
    .getByRole("button", { name: "Add another set", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Add another set", exact: true })
    .click();
  await expect(page.getByText(/Set 3 of 5/)).toBeVisible();
  await expect(page.getByLabel("Reps", { exact: true })).toHaveValue("9");
  await reloadSaved(page);
  await expect(page.getByText(/Set 3 of 5/)).toBeVisible();
  await expect(page.getByLabel("Weight (kg)", { exact: true })).toHaveValue(
    "30",
  );
  for (let i = 0; i < 2; i++) {
    await page
      .getByRole("button", { name: "Complete set & start rest" })
      .click();
    await page
      .getByRole("button", { name: /Skip rest|Start next set/ })
      .click();
    await expect(
      page.getByRole("heading", { name: "Barbell Curl", exact: true }),
    ).toBeVisible();
  }
  await expect(page.getByText(/Set 5 of 5/)).toBeVisible();
  await page.getByRole("button", { name: "Complete set", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Dumbbell Bench Press", exact: true }),
  ).toBeVisible();
});
async function seed(page: Page, grouped = false, variant = "strength") {
  await page.goto("");
  await expect(page.getByText("Saved on this device").first()).toBeAttached();
  const backup = await page.evaluate(
    async ({ grouped, variant }) => {
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const req = indexedDB.open("fitspoh", 1);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
      const tx = db.transaction("journal", "readonly");
      const store = tx.objectStore("journal");
      const get = store.get("state");
      const state = await new Promise<any>((resolve, reject) => {
        get.onsuccess = () => resolve(get.result);
        get.onerror = () => reject(get.error);
      });
      db.close();
      {
        const s = state;
        const movement = (id: string, exerciseId: string, count: number) => ({
          id,
          exerciseId,
          rest: 1,
          notes: "Keep elbows still",
          superset: grouped ? "A" : "",
          repMin: 8,
          repMax: 12,
          sets: Array.from({ length: count }, (_, i) => ({
            id: `${id}-${i}`,
            weight: 20,
            reps: 10,
            seconds: 60,
            distance: 0,
            type: "working",
            done: false,
          })),
        });
        const movements = [
          movement("curl", "Barbell_Curl", 3),
          movement("bench", "Dumbbell_Bench_Press", grouped ? 3 : 1),
        ];
        s.plans = [
          {
            id: "plan",
            name: "My plan",
            next: 0,
            days: [{ id: "day", name: "Upper day", movements }],
          },
        ];
        const old = movement("old", "Barbell_Curl", 2);
        old.sets.forEach((x) => {
          x.done = true;
          x.weight = 25;
          x.reps = 12;
        });
        if (variant !== "strength") {
          const mode =
            variant === "cardio" || variant === "duration"
              ? variant
              : "strength";
          s.custom = [
            {
              id: "test-exercise",
              name:
                variant === "assisted"
                  ? "Assisted Test Exercise"
                  : "Test Exercise",
              mode,
              primaryMuscles: ["biceps"],
              secondaryMuscles: [],
              equipment: "machine",
              required: [],
              level: "beginner",
              category: "strength",
              instructions: ["Move with control."],
              images: [],
              cues: ["Move with control."],
              mistakes: [],
            },
          ];
          movements.splice(
            0,
            movements.length,
            movement("test", "test-exercise", 2),
          );
          old.exerciseId = "test-exercise";
          old.sets.forEach((x) => {
            x.seconds = 75;
            x.distance = 1.2;
          });
          if (variant === "warmup") movements[0].sets[0].type = "warmup";
        }
        s.workouts = [
          {
            id: "history",
            name: "Last workout",
            started: "2026-09-01T10:00:00Z",
            finished: "2026-09-01T11:00:00Z",
            movements: [old],
            notes: "",
          },
        ];
        s.active = null;
        return s;
      }
    },
    { grouped, variant },
  );
  await page.locator("input[type=file]").setInputFiles({
    name: "guided-fixture.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(backup)),
  });
  await page
    .getByRole("button", { name: "Replace and restore", exact: true })
    .click();
  await expect(page.locator(".storage-status")).toContainText(
    "Saved on this device",
  );
  await page.goto("#plans");
  await page.getByRole("button", { name: "My plan 1 days" }).click();
}
test("mobile companion edits days, remembers last time, saves entry, rests and finishes", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.setViewportSize({ width: 390, height: 844 });
  await seed(page);
  await page.getByRole("button", { name: "Edit day" }).click();
  await expect(
    page.getByRole("button", { name: "Back to plan" }),
  ).toBeVisible();
  await expect(page.locator(".day-grid")).toHaveCount(0);
  await page.getByRole("button", { name: "Back to plan" }).click();
  await page.getByRole("button", { name: "Start", exact: true }).click();
  await expect(page.getByText("Exercise 1 of 2 · Set 1 of 3")).toBeVisible();
  await expect(page.locator(".guided-last")).toContainText("25 kg × 12 reps");
  await expect(page.locator(".guided-image")).toBeVisible();
  await page.getByRole("button", { name: "Start set", exact: true }).click();
  await expect(page.getByLabel("Weight (kg)", { exact: true })).toHaveValue(
    "25",
  );
  await page.getByLabel("Weight (kg)", { exact: true }).fill("");
  await expect(page.getByText("Saved on this device").first()).toBeAttached();
  await reloadSaved(page);
  await expect(page.getByLabel("Weight (kg)", { exact: true })).toHaveValue("");
  await page
    .getByLabel("Weight (kg)", { exact: true })
    .pressSequentially("27.5");
  await page.getByLabel("Reps", { exact: true }).fill("9");
  await expect(page.getByText("Saved on this device").first()).toBeAttached();
  await reloadSaved(page);
  await expect(page.getByLabel("Weight (kg)", { exact: true })).toHaveValue(
    "27.5",
  );
  await page.getByRole("button", { name: "Complete set & start rest" }).click();
  await expect(page.getByText(/New weight record!/)).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Start next set" }),
  ).toBeVisible();
  await reloadSaved(page);
  await expect(
    page.getByRole("button", { name: "Start next set" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "+30 seconds" }).click();
  await page.getByRole("button", { name: "−30 seconds" }).click();
  await page.getByRole("button", { name: "Start next set" }).click();
  await expect(page.getByLabel("Weight (kg)", { exact: true })).toHaveValue(
    "27.5",
  );
  await expect(page.getByLabel("Reps", { exact: true })).toHaveValue("10");
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
        (await page.getByLabel("Weight (kg)", { exact: true }).boundingBox())!
          .height,
      ).toBeGreaterThanOrEqual(44);
    }
  }
  await page.screenshot({ path: ".cache/guided-mobile.png", fullPage: true });
  await page.getByRole("button", { name: "Complete set & start rest" }).click();
  await page.getByRole("button", { name: "Start next set" }).click();
  await page.getByRole("button", { name: "Complete set", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Dumbbell Bench Press", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Next exercise" }),
  ).toBeVisible();
  await expect(page.getByRole("timer")).toHaveCount(0);
  await page.getByRole("button", { name: "Next exercise" }).click();
  await page.getByRole("button", { name: "Complete set", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Workout review" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Finish workout", exact: true })
    .click();
  await page.getByRole("button", { name: "Confirm", exact: true }).click();
  await expect(page.locator(".history-card")).toHaveCount(2);
  expect(errors).toEqual([]);
});
for (const variant of ["warmup", "assisted", "cardio", "duration"]) {
  test(`${variant} sets use the correct inputs and avoid weight-record messages`, async ({
    page,
  }) => {
    await seed(page, false, variant);
    await page.getByRole("button", { name: "Start", exact: true }).click();
    await page.getByRole("button", { name: "Start set", exact: true }).click();
    if (variant === "cardio" || variant === "duration") {
      await expect(
        page.getByLabel("Duration (seconds)", { exact: true }),
      ).toHaveValue("75");
      await page.getByLabel("Duration (seconds)", { exact: true }).fill("90");
      await expect(page.getByLabel("Weight (kg)", { exact: true })).toHaveCount(
        0,
      );
      if (variant === "cardio") {
        await expect(
          page.getByLabel("Distance (km)", { exact: true }),
        ).toHaveValue("1.2");
        await page.getByLabel("Distance (km)", { exact: true }).fill("1.5");
      }
    } else await page.getByLabel("Weight (kg)", { exact: true }).fill("30");
    await page
      .getByRole("button", { name: "Complete set & start rest" })
      .click();
    await expect(page.getByText(/New weight record!/)).toHaveCount(0);
    await page.getByRole("button", { name: "Start next set" }).click();
    await page
      .getByRole("button", { name: "Complete set", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Workout review" }),
    ).toBeVisible();
  });
}
test("supersets alternate exercises and rest only after a round; overview recovers deleted cursor", async ({
  page,
}) => {
  await seed(page, true);
  await page.getByRole("button", { name: "Start", exact: true }).click();
  await page.getByText("Workout settings", { exact: true }).click();
  await page
    .getByLabel("Exercise order", { exact: true })
    .selectOption("circuit");
  await page.getByRole("button", { name: "Start set", exact: true }).click();
  await page.getByRole("button", { name: "Complete set", exact: true }).click();
  await expect(page.getByRole("timer")).toHaveCount(0);
  await page.getByRole("button", { name: "Next exercise" }).click();
  await page.getByRole("button", { name: "Complete set & start rest" }).click();
  await expect(
    page.getByRole("button", { name: "Start next set" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Overview", exact: true }).click();
  await page
    .getByRole("button", { name: "Remove exercise", exact: true })
    .first()
    .click();
  await page.getByRole("button", { name: "Back to guided workout" }).click();
  await expect(
    page.getByRole("heading", { name: "Dumbbell Bench Press", exact: true }),
  ).toBeVisible();
  await page.getByText("Workout actions", { exact: true }).click();
  await page
    .getByRole("button", { name: "Skip exercise", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Workout review" }),
  ).toBeVisible();
  await expect(page.locator("div.guided-results")).toContainText("Skipped");
});

test("straight sets stay on one exercise and old entries remain editable after advancing", async ({
  page,
}) => {
  await seed(page, true);
  await page.getByRole("button", { name: "Start", exact: true }).click();
  await page.getByRole("button", { name: "Start set", exact: true }).click();
  for (let i = 0; i < 2; i++) {
    await page
      .getByRole("button", { name: "Complete set & start rest" })
      .click();
    await expect(
      page.getByRole("heading", { name: "Barbell Curl", exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: /Skip rest|Start next set/ })
      .click();
  }
  await page.getByRole("button", { name: "Complete set", exact: true }).click();
  await page
    .getByRole("button", { name: "Next exercise", exact: true })
    .click();
  await delayJournalWrites(page);
  await page.getByLabel("Weight (kg)", { exact: true }).fill("32.5");
  await page
    .getByText("Back to a previous exercise / correct a set", { exact: true })
    .click();
  await page
    .getByRole("button", { name: "Edit Barbell Curl - set 1", exact: true })
    .click();
  await page.getByLabel("Reps", { exact: true }).fill("9");
  await page
    .getByRole("button", { name: "Save correction", exact: true })
    .click();
  await expect(page.getByLabel("Weight (kg)", { exact: true })).toHaveValue(
    "32.5",
  );
  await reloadSaved(page);
  await page
    .getByText("Back to a previous exercise / correct a set", { exact: true })
    .click();
  await expect(
    page.getByRole("button", {
      name: "Edit Barbell Curl - set 1",
      exact: true,
    }),
  ).toBeAttached();
  await expect(page.getByLabel("Weight (kg)", { exact: true })).toHaveValue(
    "32.5",
  );
});
