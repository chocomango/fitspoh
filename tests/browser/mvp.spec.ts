import { test, expect, type Page } from "@playwright/test";

async function saved(page: Page) {
  await expect(page.locator(".storage-status")).toContainText(
    "Saved on this device",
  );
}
async function journal(page: Page) {
  return page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve) => {
      const r = indexedDB.open("fitspoh", 1);
      r.onsuccess = () => resolve(r.result);
    });
    const tx = db.transaction("journal");
    const s = await new Promise<any>((resolve) => {
      const r = tx.objectStore("journal").get("state");
      r.onsuccess = () => resolve(r.result);
    });
    db.close();
    return s;
  });
}
async function restore(page: Page, data: any) {
  await page.locator("input[type=file]").setInputFiles({
    name: "journal.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify({ format: "fitspoh-backup", data })),
  });
  await page
    .getByRole("button", { name: "Replace and restore", exact: true })
    .click();
  await saved(page);
}
function movement() {
  return {
    id: "bench",
    exerciseId: "Dumbbell_Bench_Press",
    rest: 60,
    notes: "",
    superset: "",
    repMin: 8,
    repMax: 12,
    sets: [10, 10, 8].map((reps, i) => ({
      id: "set-" + i,
      weight: 27.5,
      reps,
      seconds: 60,
      distance: 0,
      type: "working",
      done: false,
    })),
  };
}

test("first run leads through equipment, Buddy, a saved plan, full workout, body stats, backup and offline recovery", async ({
  page,
  context,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("");
  await saved(page);
  await expect(
    page.getByRole("heading", {
      name: "Your first workout starts here",
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Choose my gym equipment", exact: true })
    .click();
  await page
    .getByLabel("Find equipment", { exact: true })
    .fill("does-not-exist");
  await expect(
    page.getByText("No matching equipment", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Clear equipment search", exact: true })
    .click();
  for (const name of ["Dumbbells", "Adjustable bench"]) {
    await page.getByLabel("Find equipment", { exact: true }).fill(name);
    await page
      .locator(".equipment-card")
      .filter({ has: page.getByRole("heading", { name, exact: true }) })
      .getByLabel("I have seen this equipment", { exact: true })
      .check();
  }
  await page
    .getByRole("button", { name: "Create a routine with Buddy", exact: true })
    .click();
  await page
    .getByRole("group", { name: "Experience level", exact: true })
    .getByRole("button", { name: "beginner", exact: true })
    .click();
  await page
    .getByRole("group", { name: "Session budget", exact: true })
    .getByRole("button", { name: "20", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Confirm choices & draft", exact: true })
    .click();
  await page
    .getByLabel("Draft name", { exact: true })
    .fill("My first gym routine");
  await expect(page.locator(".movement-card").first()).toBeVisible();
  await page
    .getByRole("button", { name: "Save as new plan", exact: true })
    .click();
  await page.goto("#dashboard");
  await page
    .getByRole("button", { name: "Start this workout", exact: true })
    .click();
  for (let actions = 0; actions < 30; actions++) {
    if (
      await page
        .getByRole("heading", { name: "Workout review", exact: true })
        .count()
    )
      break;
    const complete = page.getByRole("button", { name: /^Complete set/ });
    if (await complete.count()) {
      const weight = page.locator("#guided-weight");
      if ((await weight.count()) && (await weight.inputValue()) === "")
        await weight.fill("5");
      await page.getByLabel("Reps", { exact: true }).fill("10");
      await complete.click();
    } else
      await page
        .getByRole("button", {
          name: /^(Start set|Next exercise|Skip rest|Start next set)$/,
        })
        .click();
  }
  await expect(
    page.getByRole("heading", { name: "Workout review", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText(/First completed working sets at this load/).first(),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Finish workout", exact: true })
    .click();
  await page.getByRole("button", { name: "Confirm", exact: true }).click();
  await expect(page.locator(".history-card")).toHaveCount(1);
  await page.goto("#body");
  await page
    .getByRole("button", { name: "Log body stats", exact: true })
    .click();
  await page.getByLabel("Weight (kg)", { exact: true }).fill("75");
  await page.getByRole("button", { name: "Save entry", exact: true }).click();
  await page.getByText("View recorded values", { exact: true }).first().click();
  await expect(page.locator(".chart-table").first()).toContainText("75.00");
  await page.goto("#settings");
  const download = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Export full backup", exact: true })
    .click();
  const file = (await (await download).path())!;
  await page.locator("input[type=file]").setInputFiles(file);
  await page
    .getByRole("button", { name: "Replace and restore", exact: true })
    .click();
  await saved(page);
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  await context.setOffline(true);
  await page.reload();
  await page.goto("#history");
  await expect(page.locator(".history-card")).toHaveCount(1);
  await page.goto("#body");
  await expect(page.locator(".body-row")).toHaveCount(1);
  await context.setOffline(false);
  expect(errors).toEqual([]);
});

test("empty sessions offer an actionable picker and can be cancelled without creating history", async ({
  page,
}) => {
  await page.goto("");
  await saved(page);
  await page
    .getByRole("button", { name: "Start an empty workout", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Build this workout", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Add first exercise", exact: true })
    .click();
  await expect(
    page.getByRole("dialog", { name: "Choose an exercise", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Close exercise picker", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Cancel empty workout", exact: true })
    .click();
  await saved(page);
  const s = await journal(page);
  expect(s.active).toBeNull();
  expect(s.workouts).toHaveLength(0);
});

test("guided validation and undo retain actual input, and review compares working reps at the same load", async ({
  page,
}) => {
  await page.goto("");
  await saved(page);
  const s = await journal(page),
    m = movement();
  const old = structuredClone(m);
  old.id = "old-bench";
  old.sets.forEach((t, i) => {
    t.id = "old-" + i;
    t.done = true;
    t.reps = [9, 9, 8][i];
  });
  s.workouts = [
    {
      id: "previous",
      name: "Last",
      started: "2026-10-01T10:00:00Z",
      finished: "2026-10-01T11:00:00Z",
      notes: "",
      movements: [old],
    },
  ];
  s.active = {
    id: "current",
    name: "Upper",
    started: "2026-10-06T10:00:00Z",
    notes: "",
    movements: [m],
    guided: { phase: "entry", setId: "set-0" },
  };
  await restore(page, s);
  await page.goto("#workout");
  await page.getByLabel("Reps", { exact: true }).fill("0");
  await page
    .getByRole("button", { name: "Complete set & start rest", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText("whole number");
  await page.getByLabel("Reps", { exact: true }).fill("10");
  await page
    .getByRole("button", { name: "Complete set & start rest", exact: true })
    .click();
  await expect(
    page.getByRole("progressbar", {
      name: "Workout set progress",
      exact: true,
    }),
  ).toHaveAttribute("value", "1");
  await page
    .getByRole("button", { name: "Undo completed set", exact: true })
    .click();
  await expect(page.getByLabel("Reps", { exact: true })).toHaveValue("10");
  await expect(page.getByRole("progressbar")).toHaveAttribute("value", "0");
  for (let i = 0; i < 3; i++) {
    await page.getByLabel("Reps", { exact: true }).fill(String([10, 10, 8][i]));
    await page.getByRole("button", { name: /^Complete set/ }).click();
    if (i < 2)
      await page
        .getByRole("button", { name: "Skip rest", exact: true })
        .click();
  }
  await expect(page.locator(".guided-comparison")).toContainText(
    "28 total reps across 3 working sets",
  );
  await expect(page.locator(".guided-comparison")).toContainText(
    "26 reps across 3 working sets",
  );
  await page
    .getByRole("button", { name: "Finish workout", exact: true })
    .click();
  await page.getByRole("button", { name: "Confirm", exact: true }).click();
  await expect(page.locator(".history-card")).toHaveCount(2);
});

for (const broadcast of [true, false])
  test(`multiple tabs preserve the latest journal with broadcast ${broadcast}`, async ({
    page,
    context,
  }) => {
    if (!broadcast)
      await context.addInitScript(() =>
        Object.defineProperty(window, "BroadcastChannel", { value: undefined }),
      );
    await page.goto("");
    await saved(page);
    const peer = await context.newPage();
    await peer.goto("");
    await saved(peer);
    if (broadcast) {
      await peer.goto("#plans");
      await peer.getByRole("button", { name: "New plan", exact: true }).click();
      await peer
        .getByLabel("Name", { exact: true })
        .fill("Unsaved in this tab");
    }
    await page.goto("#plans");
    await page.getByRole("button", { name: "New plan", exact: true }).click();
    await page.getByLabel("Name", { exact: true }).fill("Saved elsewhere");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await saved(page);
    if (!broadcast)
      await peer.getByLabel("Weight unit", { exact: true }).selectOption("lb");
    await expect(peer.getByRole("alert")).toContainText(
      "changed in another tab",
    );
    await expect(peer.locator("main")).toHaveAttribute("inert", "");
    if (broadcast)
      await expect(peer.locator(".modal-backdrop")).toHaveAttribute(
        "inert",
        "",
      );
    const persisted = await journal(peer);
    expect(persisted.plans[0].name).toBe("Saved elsewhere");
    expect(persisted.settings.weight).toBe("kg");
    await peer
      .getByRole("button", { name: "Reload saved journal", exact: true })
      .click();
    await saved(peer);
    await expect(peer.getByRole("alert")).toHaveCount(0);
    expect((await journal(peer)).plans[0].name).toBe("Saved elsewhere");
    await peer.close();
  });

test("failed writes are recoverable and failed restores remain atomic", async ({
  page,
}) => {
  await page.addInitScript(() => {
    (window as any).rejectKey = "";
    const put = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (value, key) {
      if (key === (window as any).rejectKey)
        throw new DOMException("No space", "QuotaExceededError");
      return put.call(this, value, key);
    };
  });
  await page.goto("");
  await saved(page);
  await page.evaluate(() => {
    (window as any).rejectKey = "state";
  });
  await page.getByLabel("Weight unit", { exact: true }).selectOption("lb");
  await expect(page.getByRole("alert")).toContainText("not saved");
  expect((await journal(page)).settings.weight).toBe("kg");
  await page.evaluate(() => {
    (window as any).rejectKey = "";
  });
  await page.getByRole("button", { name: "Retry saving", exact: true }).click();
  await saved(page);
  expect((await journal(page)).settings.weight).toBe("lb");
  const old = await journal(page),
    restored = structuredClone(old);
  restored.settings.weight = "kg";
  await page.evaluate(() => {
    (window as any).rejectKey = "revision";
  });
  await page.locator("input[type=file]").setInputFiles({
    name: "restore.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(restored)),
  });
  await page
    .getByRole("button", { name: "Replace and restore", exact: true })
    .click();
  await expect(page.locator(".storage-status")).toContainText("Restore failed");
  expect((await journal(page)).settings.weight).toBe("lb");
  await page.evaluate(() => {
    (window as any).rejectKey = "";
  });
  await page
    .getByRole("button", { name: "Replace and restore", exact: true })
    .click();
  await saved(page);
  expect((await journal(page)).settings.weight).toBe("kg");
});

test.describe("dialog and media accessibility", () => {
  test.use({ serviceWorkers: "block" });
  test("routes, named dialogs, keyboard focus and unavailable photos remain usable", async ({
    page,
  }) => {
    await page.goto("#unknown");
    await saved(page);
    await expect(page.locator(".next-workout")).toBeVisible();
    await page.goto("#plans");
    const newPlan = page.getByRole("button", { name: "New plan", exact: true });
    await newPlan.click();
    await expect(
      page.getByRole("dialog", { name: "Create a training plan", exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Save", exact: true }).focus();
    await page.keyboard.press("Tab");
    await expect(page.getByLabel("Name", { exact: true })).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(newPlan).toBeFocused();
    await page.route("**/exercises/**", (route) => route.abort());
    await page.goto("#library");
    await page
      .getByLabel("Search exercises", { exact: true })
      .fill("Barbell Curl");
    await page
      .getByRole("button", { name: "Barbell Curl", exact: true })
      .click();
    await expect(
      page.getByRole("dialog", { name: "Barbell Curl", exact: true }),
    ).toBeVisible();
    await expect(page.locator(".detail-modal .photo-fallback")).toHaveCount(2);
    await expect(
      page.getByRole("heading", { name: "Setup & movement", exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Close exercise guide", exact: true })
      .click();
  });
});

test("an unreadable journal can be recovered explicitly without first overwriting it", async ({
  page,
}) => {
  await page.goto("");
  await saved(page);
  const valid = await journal(page);
  await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve) => {
      const r = indexedDB.open("fitspoh", 1);
      r.onsuccess = () => resolve(r.result);
    });
    const tx = db.transaction("journal", "readwrite");
    tx.objectStore("journal").put(
      { version: 99, important: "preserve" },
      "state",
    );
    await new Promise<void>((resolve) => {
      tx.oncomplete = () => resolve();
    });
    db.close();
  });
  await page.reload();
  await expect(page.getByRole("alert")).toContainText("could not be opened");
  expect((await journal(page)).important).toBe("preserve");
  await restore(page, valid);
  await expect(page.getByRole("alert")).toHaveCount(0);
  expect((await journal(page)).version).toBe(1);
});
