import { test, expect, type Page } from "@playwright/test";

async function seed(page: Page, grouped = false, unknown = false) {
  await page.goto("");
  await expect(page.getByText("Saved on this device").first()).toBeAttached();
  await page.evaluate(
    async ({ grouped, unknown }) => {
      const db = await new Promise<IDBDatabase>((resolve) => {
        const r = indexedDB.open("fitspoh", 1);
        r.onsuccess = () => resolve(r.result);
      });
      const tx = db.transaction("journal", "readwrite");
      const store = tx.objectStore("journal");
      const r = store.get("state");
      r.onsuccess = () => {
        const s = r.result;
        const movement = (id: string, exerciseId: string, group = "") => ({
          id,
          exerciseId,
          rest: 90,
          notes: "",
          superset: group,
          repMin: 8,
          repMax: 12,
          sets: [0, 1].map((i) => ({
            id: id + i,
            weight: 20,
            reps: 10,
            seconds: 60,
            distance: 0,
            type: "working",
            done: false,
            needsLoad: unknown,
          })),
        });
        s.plans = [
          { id: "empty", name: "Empty plan", next: 0, days: [] },
          {
            id: "a",
            name: "Plan A",
            next: 0,
            days: [
              {
                id: "day-a",
                name: "Upper A",
                movements: [
                  movement("curl", "Barbell_Curl", grouped ? "A" : ""),
                  movement("bench", "Dumbbell_Bench_Press", grouped ? "A" : ""),
                  movement("row", "Seated_Cable_Rows"),
                ],
              },
            ],
          },
          {
            id: "b",
            name: "Plan B",
            next: 0,
            days: [
              {
                id: "day-b",
                name: "Upper B",
                movements: [movement("press", "Dumbbell_Bench_Press")],
              },
            ],
          },
        ];
        s.workouts = [];
        s.active = null;
        s.timer = null;
        s.equipment.forEach((e: any) => {
          e.confirmed = true;
          e.unavailable = false;
        });
        store.put(s, "state");
      };
      await new Promise<void>((resolve) => {
        tx.oncomplete = () => resolve();
      });
      db.close();
    },
    { grouped, unknown },
  );
  await page.reload();
}
async function saved(page: Page) {
  await expect(page.locator(".storage-status")).toContainText(
    "Saved on this device",
  );
  await page.waitForTimeout(150);
}
async function read(page: Page) {
  return page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve) => {
      const r = indexedDB.open("fitspoh", 1);
      r.onsuccess = () => resolve(r.result);
    });
    const tx = db.transaction("journal");
    const value = await new Promise<any>((resolve) => {
      const r = tx.objectStore("journal").get("state");
      r.onsuccess = () => resolve(r.result);
    });
    db.close();
    return value;
  });
}

test("Use this plan marks the active choice and deleting it falls back to a nonempty plan", async ({
  page,
}) => {
  await seed(page);
  await page.goto("#plans");
  await page
    .getByRole("button", { name: "Plan B 1 days", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Use this plan", exact: true })
    .click();
  await expect(page.getByText("Active plan", { exact: true })).toBeVisible();
  await page.goto("#dashboard");
  await expect(page.getByLabel("Active plan", { exact: true })).toHaveValue(
    "b",
  );
  await page.goto("#plans");
  await page
    .locator(".section-title")
    .filter({ has: page.getByRole("heading", { name: "Plan B", exact: true }) })
    .getByRole("button")
    .last()
    .click();
  await page.getByRole("button", { name: "Confirm", exact: true }).click();
  await page.goto("#dashboard");
  await expect(page.getByLabel("Active plan", { exact: true })).toHaveValue(
    "a",
  );
  await expect(page.locator(".next-workout")).toContainText("Upper A");
});

test("stack quick controls stay unitless in pounds and preserve their saved increment", async ({
  page,
}) => {
  await seed(page);
  await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve) => {
      const r = indexedDB.open("fitspoh", 1);
      r.onsuccess = () => resolve(r.result);
    });
    const tx = db.transaction("journal", "readwrite");
    const store = tx.objectStore("journal");
    const r = store.get("state");
    r.onsuccess = () => {
      const s = r.result;
      s.custom = [
        {
          id: "test-stack",
          name: "Test stack",
          mode: "strength",
          equipment: "machine",
          loadKind: "stack",
          primaryMuscles: ["shoulders"],
          secondaryMuscles: [],
          required: [],
          level: "beginner",
          category: "strength",
          instructions: ["Move slowly."],
          images: [],
          cues: [],
          mistakes: [],
        },
      ];
      s.plans[2].days[0].movements[0].exerciseId = "test-stack";
      s.settings.activePlanId = "b";
      s.settings.weight = "lb";
      store.put(s, "state");
    };
    await new Promise<void>((resolve) => {
      tx.oncomplete = () => resolve();
    });
    db.close();
  });
  await page.reload();
  await page
    .getByRole("button", { name: "Start this workout", exact: true })
    .click();
  await page.getByRole("button", { name: "Start set", exact: true }).click();
  await page
    .getByRole("button", { name: "Increase weight", exact: true })
    .click();
  await expect(
    page.getByLabel("Weight (stack setting)", { exact: true }),
  ).toHaveValue("21");
  await page.getByText("Workout settings", { exact: true }).click();
  await page.getByLabel("Weight increment", { exact: true }).fill("2");
  await page
    .getByRole("button", { name: "Increase weight", exact: true })
    .click();
  await expect(
    page.getByLabel("Weight (stack setting)", { exact: true }),
  ).toHaveValue("23");
  await saved(page);
  await page.reload();
  await page.getByText("Workout settings", { exact: true }).click();
  await expect(
    page.getByLabel("Weight increment", { exact: true }),
  ).toHaveValue("2");
});

test("Home prioritizes the active plan, restores selection and leaves it unchanged by Buddy saves", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await seed(page);
  await expect(page.getByLabel("Active plan", { exact: true })).toHaveValue(
    "a",
  );
  const hero = await page.locator(".next-workout").boundingBox(),
    stats = await page.locator(".stats-grid").boundingBox();
  expect(hero!.y).toBeLessThan(stats!.y);
  await page.getByLabel("Active plan", { exact: true }).selectOption("b");
  await saved(page);
  await page.reload();
  await expect(page.locator(".next-workout")).toContainText("Upper B");
  await page.goto("#buddy");
  await page
    .getByRole("button", { name: "Confirm choices & draft", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Save as new plan", exact: true })
    .click();
  await page.goto("#dashboard");
  await expect(page.getByLabel("Active plan", { exact: true })).toHaveValue(
    "b",
  );
  await page
    .getByRole("button", { name: "Start this workout", exact: true })
    .click();
  await page.goto("#dashboard");
  await expect(
    page.getByRole("button", { name: "Resume workout", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Start an empty workout", exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Resume workout", exact: true })
    .click();
  await expect(page.locator(".guided-workout")).toContainText("Upper B");
});

test("quick adjustments preserve input and increments through units, reload and both mobile themes", async ({
  page,
}) => {
  await seed(page);
  await page
    .getByRole("button", { name: "Start this workout", exact: true })
    .click();
  await page.getByRole("button", { name: "Start set", exact: true }).click();
  await page
    .getByRole("button", { name: "Increase weight", exact: true })
    .click();
  await expect(page.getByLabel("Weight (kg)", { exact: true })).toHaveValue(
    "22.5",
  );
  await page
    .getByRole("button", { name: "Increase reps", exact: true })
    .click();
  await expect(page.getByLabel("Reps", { exact: true })).toHaveValue("11");
  await page.getByText("Workout settings", { exact: true }).click();
  await page.getByLabel("Weight increment", { exact: true }).fill("1.25");
  await page
    .getByRole("button", { name: "Increase weight", exact: true })
    .click();
  await expect(page.getByLabel("Weight (kg)", { exact: true })).toHaveValue(
    "23.75",
  );
  await saved(page);
  await page.reload();
  await expect(page.getByLabel("Weight (kg)", { exact: true })).toHaveValue(
    "23.75",
  );
  for (const theme of ["focus", "sumikko"]) {
    if (theme === "sumikko")
      await page.getByRole("switch", { name: "Sumikko Gurashi theme" }).click();
    for (const width of [320, 390, 430]) {
      await page.setViewportSize({ width, height: 500 });
      await page.getByLabel("Reps", { exact: true }).focus();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBeTruthy();
      if (width === 390)
        await page.screenshot({
          path: `.cache/easier-entry-${theme}.png`,
          fullPage: true,
        });
      await expect(
        page.getByRole("button", { name: "Increase weight", exact: true }),
      ).toBeVisible();
    }
  }
  await page.getByLabel("Weight (kg)", { exact: true }).fill("0");
  await page
    .getByRole("button", { name: "Decrease weight", exact: true })
    .click();
  await expect(page.getByLabel("Weight (kg)", { exact: true })).toHaveValue(
    "0",
  );
  await page.getByLabel("Reps", { exact: true }).fill("0");
  await page
    .getByRole("button", { name: "Decrease reps", exact: true })
    .click();
  await expect(page.getByLabel("Reps", { exact: true })).toHaveValue("0");
  await page.getByLabel("Weight (kg)", { exact: true }).fill("23.75");
  await page.goto("#settings");
  await page.getByLabel("Weight unit", { exact: true }).selectOption("lb");
  await page.goto("#workout");
  await expect(page.getByLabel("Weight (lb)", { exact: true })).toHaveValue(
    "52.36",
  );
  await page.getByText("Workout settings", { exact: true }).click();
  await expect(
    page.getByLabel("Weight increment", { exact: true }),
  ).toHaveValue("2.76");
});

test("unknown loads cannot be incremented until explicitly entered", async ({
  page,
}) => {
  await seed(page, false, true);
  await page
    .getByRole("button", { name: "Start this workout", exact: true })
    .click();
  await page.getByRole("button", { name: "Start set", exact: true }).click();
  await expect(page.getByLabel("Weight (kg)", { exact: true })).toHaveValue("");
  await expect(
    page.getByRole("button", { name: "Increase weight", exact: true }),
  ).toBeDisabled();
  await page.getByLabel("Weight (kg)", { exact: true }).fill("0");
  await expect(
    page.getByRole("button", { name: "Increase weight", exact: true }),
  ).toBeEnabled();
  await page.getByLabel("Weight (kg)", { exact: true }).fill("");
  await saved(page);
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Increase weight", exact: true }),
  ).toBeDisabled();
});

test("busy equipment postpones partial groups with input intact and blocks postponing the final group", async ({
  page,
}) => {
  await seed(page, true);
  await page
    .getByRole("button", { name: "Start this workout", exact: true })
    .click();
  await page.getByRole("button", { name: "Start set", exact: true }).click();
  await page.getByRole("button", { name: "Complete set", exact: true }).click();
  await page
    .getByRole("button", { name: "Next exercise", exact: true })
    .click();
  await page.getByLabel("Weight (kg)", { exact: true }).fill("22.5");
  await page.getByLabel("Reps", { exact: true }).fill("");
  await page
    .getByRole("button", { name: "Equipment busy", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Do this later", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Seated Cable Rows", exact: true }),
  ).toBeVisible();
  await saved(page);
  const s = await read(page);
  expect(s.active.movements.map((m: any) => m.exerciseId)).toEqual([
    "Seated_Cable_Rows",
    "Barbell_Curl",
    "Dumbbell_Bench_Press",
  ]);
  expect(s.active.movements[1].sets[0].done).toBeTruthy();
  expect(s.plans[1].days[0].movements[0].exerciseId).toBe("Barbell_Curl");
  await page.reload();
  await page
    .getByRole("button", { name: "Skip exercise", exact: true })
    .click();
  await page.getByRole("button", { name: "Start set", exact: true }).click();
  await expect(page.getByLabel("Weight (kg)", { exact: true })).toHaveValue(
    "22.5",
  );
  await expect(page.getByLabel("Reps", { exact: true })).toHaveValue("");
  await page
    .getByRole("button", { name: "Equipment busy", exact: true })
    .click();
  await expect(page.getByText(/No other exercises remain/)).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Do this later", exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Find an alternative", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Workout Buddy", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Confirm choices & suggest", exact: true })
    .click();
  await expect(page.locator(".buddy-option").first()).toBeVisible();
});

test("screen wake lock acquires, releases on navigation and toggle, and reacquires on return", async ({
  page,
}) => {
  await page.addInitScript(() => {
    (window as any).wakeCalls = { requests: 0, releases: 0 };
    Object.defineProperty(navigator, "wakeLock", {
      configurable: true,
      value: {
        request: async () => {
          (window as any).wakeCalls.requests++;
          const lock = new EventTarget();
          (lock as any).release = async () => {
            (window as any).wakeCalls.releases++;
            lock.dispatchEvent(new Event("release"));
          };
          return lock;
        },
      },
    });
  });
  await seed(page);
  await page
    .getByRole("button", { name: "Start this workout", exact: true })
    .click();
  await page.getByText("Workout settings", { exact: true }).click();
  await page.getByLabel("Keep screen awake", { exact: true }).check();
  await expect(
    page.getByText("Screen stays awake while this workout is visible.", {
      exact: true,
    }),
  ).toBeVisible();
  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "hidden",
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect
    .poll(() => page.evaluate(() => (window as any).wakeCalls.releases))
    .toBe(1);
  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "visible",
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect
    .poll(() => page.evaluate(() => (window as any).wakeCalls.requests))
    .toBe(2);
  await page.goto("#dashboard");
  await expect
    .poll(() => page.evaluate(() => (window as any).wakeCalls.releases))
    .toBe(2);
  await page
    .getByRole("button", { name: "Resume workout", exact: true })
    .click();
  await expect
    .poll(() => page.evaluate(() => (window as any).wakeCalls.requests))
    .toBe(3);
  await page.getByText("Workout settings", { exact: true }).click();
  await page.getByLabel("Keep screen awake", { exact: true }).uncheck();
  await expect
    .poll(() => page.evaluate(() => (window as any).wakeCalls.releases))
    .toBe(3);
});

for (const variant of ["denied", "unsupported"])
  test(`screen-awake ${variant} keeps the workout usable`, async ({ page }) => {
    await page.addInitScript((variant) => {
      Object.defineProperty(navigator, "wakeLock", {
        configurable: true,
        value:
          variant === "unsupported"
            ? undefined
            : {
                request: async () => {
                  throw new Error("Denied");
                },
              },
      });
      if (variant === "unsupported") {
        delete (Navigator.prototype as any).wakeLock;
        delete (navigator as any).wakeLock;
      }
    }, variant);
    await seed(page);
    await page
      .getByRole("button", { name: "Start this workout", exact: true })
      .click();
    await page.getByText("Workout settings", { exact: true }).click();
    await page.getByLabel("Keep screen awake", { exact: true }).check();
    await expect(
      page.getByText(
        variant === "denied"
          ? /could not be enabled/
          : /unavailable in this browser/,
      ),
    ).toBeVisible();
    await page.getByRole("button", { name: "Start set", exact: true }).click();
    await page
      .getByRole("button", { name: "Increase reps", exact: true })
      .click();
    await expect(page.getByLabel("Reps", { exact: true })).toHaveValue("11");
  });
