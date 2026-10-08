import { expect, test, type Page } from "@playwright/test";

async function seed(page: Page, completed = false) {
  await page.goto("");
  await expect(page.getByText("Saved on this device").first()).toBeAttached();
  await page.evaluate(async (completed) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("fitspoh", 1);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const transaction = db.transaction("journal", "readwrite");
    const journal = transaction.objectStore("journal");
    const request = journal.get("state");
    request.onsuccess = () => {
      const state = request.result;
      const movement = (id: string, exerciseId: string, sets: number) => ({
        id,
        exerciseId,
        rest: 90,
        notes: "",
        superset: "",
        repMin: 8,
        repMax: 12,
        sets: Array.from({ length: sets }, (_, index) => ({
          id: `${id}-${index}`,
          weight: 20,
          reps: 10,
          seconds: 60,
          distance: 0,
          type: "working",
          done: completed && id === "curl" && index === 0,
          skipped: false,
        })),
      });
      state.active = {
        id: "workout-flow",
        name: "Upper workout",
        planId: "flow-plan",
        dayId: "flow-day",
        started: new Date().toISOString(),
        movements: [
          movement("curl", "Barbell_Curl", 3),
          movement("bench", "Dumbbell_Bench_Press", 2),
        ],
        notes: "",
        setOrder: "exercise",
        guided: { setId: completed ? "curl-1" : "curl-0", phase: "entry" },
      };
      state.plans = [
        {
          id: "flow-plan",
          name: "My saved routine",
          next: 0,
          days: [
            {
              id: "flow-day",
              name: "Upper workout",
              movements: structuredClone(state.active.movements).map(
                (movement: any) => ({
                  ...movement,
                  sets: movement.sets.map((set: any) => ({
                    ...set,
                    done: false,
                  })),
                }),
              ),
            },
          ],
        },
      ];
      state.workouts = [];
      state.timer = null;
      state.settings.theme = "focus";
      state.settings.weight = "kg";
      state.settings.effort = "off";
      state.settings.activePlanId = "flow-plan";
      journal.put(state, "state");
    };
    await new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
    db.close();
  }, completed);
  await page.goto("#workout");
  await page.reload();
  await expect(page.getByLabel("Reps", { exact: true })).toBeVisible();
}

async function read(page: Page) {
  return page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("fitspoh", 1);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const state = await new Promise<any>((resolve, reject) => {
      const request = db
        .transaction("journal", "readonly")
        .objectStore("journal")
        .get("state");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    db.close();
    return state;
  });
}

async function expand(page: Page, label: string) {
  const summary = page.locator("summary").filter({ hasText: label });
  if ((await summary.locator("..").getAttribute("open")) === null)
    await summary.click();
}

async function continueExercise(page: Page, name: string) {
  await expand(page, "Workout exercises");
  await page
    .getByRole("button", { name: `Continue ${name}`, exact: true })
    .click();
  const start = page.getByRole("button", { name: "Start set", exact: true });
  if (await start.isVisible()) await start.click();
}

test("completed-set corrections preserve completion and cancel safely after reload", async ({
  page,
}) => {
  await seed(page, true);
  await page.getByRole("button", { name: "Edit set 1", exact: true }).click();
  await page.getByLabel("Weight (kg)", { exact: true }).fill("22.5");
  await page.getByLabel("Reps", { exact: true }).fill("8");
  await expect(page.getByLabel("Workout set progress")).toHaveAttribute(
    "value",
    "1",
  );
  await expect
    .poll(async () => (await read(page)).active.guided.editing?.setId)
    .toBe("curl-0");
  await expect
    .poll(async () => (await read(page)).active.movements[0].sets[0].done)
    .toBe(true);
  await page.reload();
  await expect(page.getByLabel("Weight (kg)", { exact: true })).toHaveValue(
    "22.5",
  );
  await expect(page.getByLabel("Reps", { exact: true })).toHaveValue("8");
  await page
    .getByRole("button", { name: "Cancel correction", exact: true })
    .click();
  await expect
    .poll(async () => (await read(page)).active.movements[0].sets[0].weight)
    .toBe(20);
  await expect
    .poll(async () => (await read(page)).active.guided.setId)
    .toBe("curl-1");
  await page.getByRole("button", { name: "Edit set 1", exact: true }).click();
  await page.getByLabel("Weight (kg)", { exact: true }).fill("25");
  await page.getByLabel("Reps", { exact: true }).fill("9");
  await page
    .getByRole("button", { name: "Save correction", exact: true })
    .click();
  await expect
    .poll(async () => (await read(page)).active.movements[0].sets[0].weight)
    .toBe(25);
  const state = await read(page);
  expect(state.active.movements[0].sets[0]).toMatchObject({
    done: true,
    reps: 9,
  });
  expect(state.active.guided.setId).toBe("curl-1");
  expect(state.timer).toBeNull();
  await expect(page.getByLabel("Workout set progress")).toHaveAttribute(
    "value",
    "1",
  );
});

test("pausing rest freezes its remaining time through reload and resumes it", async ({
  page,
}) => {
  await seed(page);
  await page
    .getByRole("button", { name: "Complete set & start rest", exact: true })
    .click();
  await expect(
    page.getByRole("timer", { name: "Rest countdown" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Pause workout", exact: true })
    .click();
  await expect
    .poll(async () => (await read(page)).active.pausedAt)
    .toBeGreaterThan(0);
  const paused = await read(page);
  expect(paused.timer).toBeNull();
  expect(paused.active.pausedRestMs).toBeGreaterThan(70000);
  await page.waitForTimeout(1200);
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Resume workout", exact: true }),
  ).toBeVisible();
  const reloaded = await read(page);
  expect(reloaded.active.pausedRestMs).toBe(paused.active.pausedRestMs);
  expect(reloaded.active.pausedAt).toBe(paused.active.pausedAt);
  expect(reloaded.timer).toBeNull();
  await page
    .getByRole("button", { name: "Resume workout", exact: true })
    .click();
  await expect
    .poll(async () => (await read(page)).active.pausedAt ?? null)
    .toBeNull();
  const resumed = await read(page);
  expect(resumed.timer - Date.now()).toBeGreaterThan(
    paused.active.pausedRestMs - 5000,
  );
  await expect(
    page.getByRole("timer", { name: "Rest countdown" }),
  ).toBeVisible();
});

test("skip just one set and undo it after reload without losing the entered result", async ({
  page,
}) => {
  await seed(page);
  await page.getByLabel("Weight (kg)", { exact: true }).fill("22.5");
  await page.getByLabel("Reps", { exact: true }).fill("9");
  await expand(page, "Workout actions");
  await page
    .getByRole("button", { name: "Skip this set", exact: true })
    .click();
  await expect
    .poll(async () => (await read(page)).active.movements[0].sets[0].skipped)
    .toBe(true);
  const skipped = await read(page);
  expect(skipped.active.movements[0].sets[1].skipped).toBe(false);
  expect(skipped.active.movements[0].sets[2].skipped).toBe(false);
  await page.reload();
  await page
    .getByRole("button", { name: "Undo skipped set", exact: true })
    .click();
  await expect(page.getByLabel("Weight (kg)", { exact: true })).toHaveValue(
    "22.5",
  );
  await expect(page.getByLabel("Reps", { exact: true })).toHaveValue("9");
  await expect
    .poll(async () => (await read(page)).active.guided.setId)
    .toBe("curl-0");
  const restored = await read(page);
  expect(restored.active.movements[0].sets[0]).toMatchObject({
    done: false,
    skipped: false,
  });
  await expect(page.getByLabel("Workout set progress")).toHaveAttribute(
    "max",
    "5",
  );
});

test("jumping between exercises keeps each unfinished draft and its blank fields", async ({
  page,
}) => {
  await seed(page);
  await page.getByLabel("Weight (kg)", { exact: true }).fill("22.5");
  await page.getByLabel("Reps", { exact: true }).fill("");
  await continueExercise(page, "Dumbbell Bench Press");
  await page.getByLabel("Weight (kg)", { exact: true }).fill("32.5");
  await page.getByLabel("Reps", { exact: true }).fill("11");
  await continueExercise(page, "Barbell Curl");
  await expect(page.getByLabel("Weight (kg)", { exact: true })).toHaveValue(
    "22.5",
  );
  await expect(page.getByLabel("Reps", { exact: true })).toHaveValue("");
  await expect
    .poll(async () => (await read(page)).active.guided.setId)
    .toBe("curl-0");
  await page.reload();
  await expect(page.getByLabel("Reps", { exact: true })).toHaveValue("");
  await continueExercise(page, "Dumbbell Bench Press");
  await expect(page.getByLabel("Weight (kg)", { exact: true })).toHaveValue(
    "32.5",
  );
  await expect(page.getByLabel("Reps", { exact: true })).toHaveValue("11");
  const state = await read(page);
  expect(
    state.active.movements
      .flatMap((movement: any) => movement.sets)
      .some((set: any) => set.done || set.skipped),
  ).toBe(false);
  await page
    .getByRole("button", { name: "Complete set & start rest", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Dumbbell Bench Press", exact: true }),
  ).toBeVisible();
  await expect
    .poll(async () => (await read(page)).active.guided.setId)
    .toBe("bench-1");
});

test("main set action stays reachable on narrow phones in both themes", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await seed(page);
  for (const theme of ["focus", "sumikko"]) {
    if (theme === "sumikko")
      await page.getByRole("switch", { name: "Sumikko Gurashi theme" }).click();
    for (const width of [320, 390, 430, 440]) {
      // 440 × 763 is Playwright's iPhone 16 Pro Max browser viewport.
      await page.setViewportSize({ width, height: width === 440 ? 763 : 640 });
      await page.evaluate(() => window.scrollTo(0, 0));
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      const primary = page.getByRole("button", {
        name: "Complete set & start rest",
        exact: true,
      });
      await expect(primary).toBeInViewport();
      const action = (await primary.boundingBox())!;
      const actionBar = (await page
        .locator(".guided-action-bar")
        .boundingBox())!;
      const nav = (await page.locator(".mobile-nav").boundingBox())!;
      expect(action.height).toBeGreaterThanOrEqual(44);
      expect(action.y + action.height).toBeLessThanOrEqual(nav.y);
      if (width === 390 || width === 440) {
        for (const input of ["Weight (kg)", "Reps"]) {
          const field = page.getByLabel(input, { exact: true });
          await expect(field).toBeInViewport();
          const box = (await field.boundingBox())!;
          expect(box.y + box.height).toBeLessThanOrEqual(actionBar.y);
        }
        for (const label of ["Increase weight", "Increase reps"]) {
          const quick = page.getByRole("button", { name: label, exact: true });
          await expect(quick).toBeInViewport();
          const box = (await quick.boundingBox())!;
          expect(box.y + box.height).toBeLessThanOrEqual(actionBar.y);
        }
      }
      await page.getByLabel("Reps", { exact: true }).focus();
      await expect(primary).toBeInViewport();
      if (width === 390)
        await page.screenshot({
          path:
            theme === "focus"
              ? ".cache/workout-flow-mobile.png"
              : ".cache/workout-flow-mobile-sumikko.png",
        });
    }
  }
  expect(errors).toEqual([]);
});

test("warm-up load stays separate from working targets and does not change the saved routine", async ({
  page,
}) => {
  await seed(page);
  const plan = (await read(page)).plans;
  await page.getByLabel("Weight (kg)", { exact: true }).fill("27.5");
  await page.getByLabel("Reps", { exact: true }).fill("9");
  await expand(page, "Workout actions");
  await page
    .getByRole("button", { name: "Add warm-up set", exact: true })
    .click();
  await expect(page.getByLabel("Weight (kg)", { exact: true })).toHaveValue("");
  await page.getByLabel("Weight (kg)", { exact: true }).fill("10");
  await page.getByLabel("Reps", { exact: true }).fill("12");
  await page
    .getByRole("button", { name: "Complete set & start rest", exact: true })
    .click();
  await page.getByRole("button", { name: "Skip rest", exact: true }).click();
  await expect(page.getByLabel("Weight (kg)", { exact: true })).toHaveValue(
    "27.5",
  );
  await expect(page.getByLabel("Reps", { exact: true })).toHaveValue("9");
  await expect
    .poll(async () => (await read(page)).active.guided.setId)
    .toBe("curl-0");
  const state = await read(page);
  expect(state.active.movements[0].sets[0]).toMatchObject({
    done: true,
    type: "warmup",
    weight: 10,
    reps: 12,
  });
  expect(state.active.movements[0].sets[1]).toMatchObject({
    id: "curl-0",
    done: false,
    type: "working",
    weight: 27.5,
    reps: 9,
  });
  expect(state.plans).toEqual(plan);
});

test("finishing early saves actual completed work and preserves the saved routine", async ({
  page,
}) => {
  await seed(page);
  const plan = (await read(page)).plans;
  await page.getByLabel("Weight (kg)", { exact: true }).fill("25");
  await page.getByLabel("Reps", { exact: true }).fill("9");
  await page
    .getByRole("button", { name: "Complete set & start rest", exact: true })
    .click();
  await expand(page, "Workout actions");
  await page
    .getByRole("button", { name: "Finish workout early", exact: true })
    .click();
  await page.getByRole("button", { name: "Confirm", exact: true }).click();
  await expect(page.locator(".history-card")).toHaveCount(1);
  await expect.poll(async () => (await read(page)).active).toBeNull();
  const state = await read(page);
  expect(state.timer).toBeNull();
  expect(state.workouts).toHaveLength(1);
  const sets = state.workouts[0].movements.flatMap(
    (movement: any) => movement.sets,
  );
  expect(sets.filter((set: any) => set.done)).toHaveLength(1);
  expect(sets[0]).toMatchObject({ weight: 25, reps: 9 });
  expect(sets.filter((set: any) => !set.done)).toHaveLength(4);
  expect(state.plans).toEqual(plan);
});
