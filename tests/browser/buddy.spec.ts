import { test, expect, type Page } from "@playwright/test";
import { readJournal as read, restoreJournal } from "./journal-fixture";

async function seed(page: Page, withStack = false) {
  await page.goto("#buddy");
  await expect(page.getByText("Saved on this device").first()).toBeAttached();
  const s = await read(page);
  s.equipment.forEach((e: { confirmed: boolean; unavailable: boolean }) => {
    e.confirmed = true;
    e.unavailable = false;
  });
  const movement = (
    id: string,
    exerciseId: string,
    weight: number,
    optional = false,
  ) => ({
    id,
    exerciseId,
    weight,
    rest: 90,
    notes: "Preserve targets",
    superset: "",
    repMin: 8,
    repMax: 12,
    optional,
    sets: Array.from({ length: 3 }, (_, i) => ({
      id: `${id}-${i}`,
      weight,
      reps: 10,
      seconds: 60,
      distance: 0,
      type: "working",
      done: false,
    })),
  });
  const moves = [
    movement("bench-source", "Dumbbell_Bench_Press", 27.5),
    movement("lat-source", "Wide-Grip_Lat_Pulldown", 60),
    movement("row-source", "Seated_Cable_Rows", 63.75),
    movement("incline-source", "Incline_Dumbbell_Press", 25),
    movement("lateral-source", "Side_Lateral_Raise", 0, true),
  ];
  moves[0].sets[0].reps = 9;
  moves[0].sets[2].reps = 8;
  s.plans = [
    {
      id: "source-plan",
      name: "My existing plan",
      next: 0,
      days: [
        {
          id: "source-day",
          name: "Upper source",
          notes: "My source notes",
          movements: moves,
        },
      ],
    },
  ];
  const old = movement("history-bench", "Dumbbell_Bench_Press", 27.5);
  old.sets.forEach((t) => {
    t.done = true;
  });
  s.workouts = [
    {
      id: "old-workout",
      name: "Previous",
      started: "2026-10-01T10:00:00Z",
      finished: "2026-10-01T11:00:00Z",
      notes: "",
      movements: [old],
    },
  ];
  s.active = null;
  if (withStack) {
    s.settings.weight = "lb";
    s.equipment.push({
      id: "lateral raise machine",
      name: "Lateral machine",
      confirmed: true,
      unavailable: false,
    });
    s.custom.push({
      id: "personal-lateral-machine",
      name: "Lateral Raise Machine",
      loadKind: "stack",
      required: ["lateral raise machine"],
      equipment: "machine",
      level: "beginner",
      category: "strength",
      mode: "strength",
      primaryMuscles: ["shoulders"],
      secondaryMuscles: [],
      images: [],
      instructions: ["Use controlled movement."],
      cues: ["Use controlled movement."],
      mistakes: [],
    });
    const previous = movement("stack-history", "personal-lateral-machine", 30);
    previous.sets.forEach((t) => {
      t.done = true;
    });
    s.workouts[0].movements.push(previous);
  }
  await restoreJournal(page, s);

  await expect(
    page.getByRole("heading", { name: "Workout Buddy", exact: true, level: 1 }),
  ).toBeVisible();
}
async function waitForDraft(page: Page) {
  await expect
    .poll(async () => !!(await read(page))?.buddy?.draft)
    .toBeTruthy();
}

test("Buddy creates reviewable routines, requires explicit load choice, and survives backup and offline recovery", async ({
  page,
  context,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.setViewportSize({ width: 390, height: 844 });
  await seed(page);
  await page.getByLabel("Workout focus", { exact: true }).selectOption("upper");
  await page
    .getByRole("button", { name: "Confirm choices & draft", exact: true })
    .click();
  await expect(
    page.getByText("Your draft is ready for review", { exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("Set 1 weight").first()).toHaveValue("");
  await page
    .getByRole("button", {
      name: "Use last load for Dumbbell Bench Press",
      exact: true,
    })
    .click();
  await expect(page.getByLabel("Set 1 weight").first()).toHaveValue("27.5");
  await waitForDraft(page);
  await expect(page.locator(".storage-status")).toContainText(
    "Saved on this device",
  );
  await page.reload();
  await expect(page.getByLabel("Set 1 weight").first()).toHaveValue("27.5");
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
    }
  }
  await page.screenshot({
    path: ".cache/buddy-draft-mobile.png",
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Save as new plan", exact: true })
    .click();
  await expect(page.locator(".plan-tabs .chip")).toHaveCount(2);
  await page
    .locator(".mobile-nav")
    .getByRole("link", { name: "More", exact: true })
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
  await page
    .locator(".more-links")
    .getByRole("link", { name: "Workout Buddy", exact: true })
    .click();
  await expect(page.getByLabel("Draft name")).toHaveValue("upper routine");
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByLabel("Draft name")).toHaveValue("upper routine");
  await page
    .getByRole("button", { name: "Start this routine", exact: true })
    .click();
  await page.getByRole("button", { name: "Start set", exact: true }).click();
  await expect(page.getByLabel("Weight (kg)", { exact: true })).toHaveValue(
    "27.5",
  );
  await page
    .getByRole("button", { name: "Complete set & start rest", exact: true })
    .click();
  await expect(page.getByRole("timer")).toBeVisible();
  expect(errors).toEqual([]);
});

test("adapted days keep main loads, trim optional exercises and require confirmation before updating", async ({
  page,
}) => {
  await seed(page);
  await page
    .getByRole("button", { name: "Adapt my workout", exact: true })
    .click();
  await page
    .getByLabel("Saved workout day", { exact: true })
    .selectOption("source-plan/source-day");
  await page
    .getByRole("group", { name: "Session budget", exact: true })
    .getByRole("button", { name: "20", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Confirm choices & draft", exact: true })
    .click();
  await expect(page.getByText(/Removed optional/)).toBeVisible();
  await expect(page.getByText(/Main targets were not reduced/)).toBeVisible();
  await expect(page.locator(".buddy-page .movement-card")).toHaveCount(4);
  await expect(page.getByLabel("Set 1 weight").nth(2)).toHaveValue("63.75");
  await page
    .getByRole("button", { name: "Review saved day update", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Update this saved day?", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await page
    .getByRole("button", { name: "Review saved day update", exact: true })
    .click();
  await page.getByRole("button", { name: "Confirm", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Back to plan", exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("Set 1 weight").nth(2)).toHaveValue("63.75");
  await expect(page.locator(".movement-card")).toHaveCount(4);
});

test("exercise alternatives explain eligibility, show guides and update only the reviewed exercise", async ({
  page,
}) => {
  await seed(page);
  await page.goto("#plans");
  await page
    .getByRole("button", { name: "My existing plan 1 days", exact: true })
    .click();
  await page.getByRole("button", { name: "Edit day", exact: true }).click();
  await page
    .getByRole("button", { name: "Find alternatives", exact: true })
    .first()
    .click();
  await page
    .getByRole("button", { name: "Confirm choices & suggest", exact: true })
    .click();
  await expect(page.locator(".buddy-option")).toHaveCount(3);
  await expect(page.locator(".buddy-option").first()).toContainText(
    "horizontal press",
  );
  await page
    .locator(".buddy-option")
    .first()
    .getByRole("button", { name: "Exercise guide", exact: true })
    .click();
  await expect(page.locator(".detail-modal")).toBeVisible();
  await page
    .getByRole("button", { name: "Close exercise guide", exact: true })
    .click();
  await page
    .locator(".buddy-option")
    .first()
    .getByRole("button", { name: "Choose this exercise", exact: true })
    .click();
  await expect(page.getByLabel("Set 1 weight").first()).toHaveValue("");
  await page
    .getByRole("button", { name: "Review exercise replacement", exact: true })
    .click();
  await page.getByRole("button", { name: "Confirm", exact: true }).click();
  await expect(page.getByLabel("Set 1 weight").nth(2)).toHaveValue("63.75");
  await expect(page.locator(".movement-card")).toHaveCount(5);
});

test("new loads are blank in the guided workout and exclusions with missing candidates explain the conflict", async ({
  page,
}) => {
  await seed(page);
  await page.getByLabel("Workout focus", { exact: true }).selectOption("pull");
  await page
    .getByRole("button", { name: "Confirm choices & draft", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Start this routine", exact: true })
    .click();
  await page.getByRole("button", { name: "Start set", exact: true }).click();
  await expect(page.getByLabel("Weight (kg)", { exact: true })).toHaveValue("");
  await page
    .getByRole("button", { name: "Complete set & start rest", exact: true })
    .click();
  await expect(page.getByText(/Choose a load for this set/)).toBeVisible();
  await page.getByLabel("Weight (kg)", { exact: true }).fill("60");
  await page
    .getByRole("button", { name: "Complete set & start rest", exact: true })
    .click();
  await page.getByRole("button", { name: "Skip rest", exact: true }).click();
  await expect(page.getByLabel("Weight (kg)", { exact: true })).toHaveValue(
    "60",
  );
  await page.goto("#buddy");
  await page
    .getByRole("button", { name: "Change choices", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Suggest an exercise", exact: true })
    .click();
  await page
    .getByLabel("Exercise to replace", { exact: true })
    .selectOption("Seated_Cable_Rows");
  await page
    .getByLabel("Exclude grip-heavy exercises", { exact: true })
    .check();
  await page
    .getByRole("button", { name: "Confirm choices & suggest", exact: true })
    .click();
  await expect(page.locator(".buddy-option")).toHaveCount(0);
  await expect(page.getByText(/Found 0 compatible options/)).toBeVisible();
});

test("changing the source after drafting blocks a stale update", async ({
  page,
}) => {
  await seed(page);
  await page
    .getByRole("button", { name: "Adapt my workout", exact: true })
    .click();
  await page
    .getByLabel("Saved workout day", { exact: true })
    .selectOption("source-plan/source-day");
  await page
    .getByRole("button", { name: "Confirm choices & draft", exact: true })
    .click();
  await waitForDraft(page);
  const s = await read(page);
  s.plans[0].days[0].movements[0].sets[0].weight = 30;
  await restoreJournal(page, s);

  await page
    .getByRole("button", { name: "Review saved day update", exact: true })
    .click();
  await expect(
    page.getByText(/original has changed since this draft/),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Confirm", exact: true }),
  ).toHaveCount(0);
});

test("all plan frequencies can be reviewed and saved as independent plans or days", async ({
  page,
}) => {
  await seed(page);
  await page
    .getByRole("group", { name: "Draft type", exact: true })
    .getByRole("button", { name: "plan", exact: true })
    .click();
  for (const frequency of [2, 3, 4, 5]) {
    await page
      .getByRole("group", { name: "Training frequency", exact: true })
      .getByRole("button", { name: String(frequency), exact: true })
      .click();
    await page
      .getByRole("button", { name: "Confirm choices & draft", exact: true })
      .click();
    await expect(
      page.getByLabel("Review draft day", { exact: true }).locator("option"),
    ).toHaveCount(frequency);
    if (frequency !== 5)
      await page
        .getByRole("button", { name: "Change choices", exact: true })
        .click();
  }
  await page
    .getByRole("button", { name: "Save as new plan", exact: true })
    .click();
  await expect(page.locator(".day-grid .day-card:not(.add-day)")).toHaveCount(
    5,
  );
  await page.goto("#buddy");
  await page
    .getByRole("button", { name: "Save as new day", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Back to plan", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Back to plan", exact: true }).click();
  await expect(page.locator(".day-grid .day-card:not(.add-day)")).toHaveCount(
    2,
  );
});

test("Buddy protects completed sets when suggesting alternatives during a live workout", async ({
  page,
}) => {
  await seed(page);
  await page.goto("#plans");
  await page
    .getByRole("button", { name: "My existing plan 1 days", exact: true })
    .click();
  await page.getByRole("button", { name: "Start", exact: true }).click();
  await page.getByRole("button", { name: "Start set", exact: true }).click();
  await page
    .getByRole("button", { name: "Complete set & start rest", exact: true })
    .click();
  await page.getByRole("button", { name: "Overview", exact: true }).click();
  await page
    .getByRole("button", { name: "Find alternatives", exact: true })
    .first()
    .click();
  await page
    .getByRole("button", { name: "Confirm choices & suggest", exact: true })
    .click();
  await page
    .locator(".buddy-option")
    .first()
    .getByRole("button", { name: "Choose this exercise", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Review exercise replacement", exact: true })
    .click();
  await expect(page.getByText(/already has completed sets/)).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Confirm", exact: true }),
  ).toHaveCount(0);
});

test("Buddy's explicit last-load action preserves unitless stack settings when units are pounds", async ({
  page,
}) => {
  await seed(page, true);
  await page.getByLabel("Workout focus", { exact: true }).selectOption("push");
  await page
    .getByRole("button", { name: "Confirm choices & draft", exact: true })
    .click();
  await page
    .getByRole("button", {
      name: "Use last load for Lateral Raise Machine",
      exact: true,
    })
    .click();
  const movement = page.locator(".buddy-page .movement-card").filter({
    has: page.getByRole("button", {
      name: "Lateral Raise Machine",
      exact: true,
    }),
  });
  await expect(
    movement.getByLabel("Set 1 weight", { exact: true }),
  ).toHaveValue("30");
  await expect(movement).toContainText("30 stack setting");
  await page
    .getByRole("button", { name: "Start this routine", exact: true })
    .click();
  await page.getByRole("button", { name: "Overview", exact: true }).click();
  await page
    .locator(".movement-card")
    .filter({
      has: page.getByRole("button", {
        name: "Lateral Raise Machine",
        exact: true,
      }),
    })
    .getByRole("button", { name: "Guide this exercise", exact: true })
    .click();
  await expect(
    page.getByLabel("Weight (stack setting)", { exact: true }),
  ).toHaveValue("30");
});
