import { expect, test, type Page } from "@playwright/test";

type SeedOptions = {
  done?: string[];
  cursor?: string;
  rest?: boolean;
  singleSet?: boolean;
  warmups?: number;
  history?: boolean;
};

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

async function seed(page: Page, options: SeedOptions = {}) {
  await page.goto("");
  await expect(page.getByText("Saved on this device").first()).toBeAttached();
  await page.evaluate(async (options) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("fitspoh", 1);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const tx = db.transaction("journal", "readwrite");
    const journal = tx.objectStore("journal");
    const request = journal.get("state");
    request.onsuccess = () => {
      const state = request.result;
      const movement = (id: string, exerciseId: string, count: number) => ({
        id,
        exerciseId,
        rest: 90,
        notes: "Seat setting 3",
        superset: "",
        repMin: 8,
        repMax: 12,
        sets: Array.from({ length: count }, (_, index) => ({
          id: `${id}-${index}`,
          weight: 20 + index * 5,
          reps: 10 - index,
          seconds: 60,
          distance: 0,
          type: "working",
          done: options.done?.includes(`${id}-${index}`) ?? false,
          skipped: false,
        })),
      });
      state.active = {
        id: "workout-recovery",
        name: "Recovery workout",
        planId: "recovery-plan",
        dayId: "recovery-day",
        started: new Date().toISOString(),
        movements: [
          movement("curl", "Barbell_Curl", options.singleSet ? 1 : 3),
          movement("bench", "Dumbbell_Bench_Press", 2),
        ],
        notes: "Preserve this workout note",
        setOrder: "exercise",
        guided: {
          setId: options.cursor ?? "curl-0",
          phase: options.rest ? "rest" : "entry",
          ...(options.rest
            ? {
                lastSetId: "curl-0",
                draft: { setId: "curl-1", values: { reps: "" } },
              }
            : {}),
        },
      };
      if (options.warmups)
        state.active.movements[0].sets.unshift(
          ...Array.from({ length: options.warmups }, (_, index) => ({
            ...state.active.movements[0].sets[0],
            id: `warm-${index}`,
            weight: 10,
            type: "warmup",
            done: true,
          })),
        );
      state.plans = [
        {
          id: "recovery-plan",
          name: "Saved recovery routine",
          next: 0,
          days: [
            {
              id: "recovery-day",
              name: "Recovery workout",
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
            {
              id: "recovery-next-day",
              name: "Next workout",
              movements: [movement("next-bench", "Dumbbell_Bench_Press", 2)],
            },
          ],
        },
      ];
      state.workouts = options.history
        ? [
            {
              id: "recovery-previous",
              name: "Previous workout",
              started: new Date(Date.now() - 86400000).toISOString(),
              finished: new Date(Date.now() - 82800000).toISOString(),
              notes: "",
              movements: [
                {
                  ...structuredClone(state.active.movements[0]),
                  id: "previous-curl",
                  sets: state.active.movements[0].sets.map(
                    (set: any, index: number) => ({
                      ...set,
                      id: `previous-curl-${index}`,
                      weight: 40,
                      reps: 12,
                      done: true,
                      skipped: false,
                    }),
                  ),
                },
              ],
            },
          ]
        : [];
      delete state.completionUndo;
      state.timer = options.rest ? Date.now() + 90000 : null;
      state.settings.theme = "focus";
      state.settings.weight = "kg";
      state.settings.effort = "off";
      state.settings.activePlanId = "recovery-plan";
      journal.put(state, "state");
    };
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  }, options);
  await page.goto("#workout");
  await page.reload();
  await expect(page.locator(".guided-workout")).toBeVisible();
  if (!options.rest)
    await expect(page.getByLabel("Reps", { exact: true })).toBeVisible();
}

async function expand(page: Page, name: string) {
  const summary = page.locator("summary").filter({ hasText: name });
  if ((await summary.locator("..").getAttribute("open")) === null)
    await summary.click();
}

async function setIds(page: Page) {
  return (await read(page)).active.movements[0].sets.map((set: any) => set.id);
}

async function finishEarly(page: Page) {
  await expand(page, "Workout actions");
  await page
    .getByRole("button", { name: "Finish workout early", exact: true })
    .click();
  await page.getByRole("button", { name: "Confirm", exact: true }).click();
  await expect.poll(async () => (await read(page)).active).toBeNull();
  await expect(page.locator(".history-card")).toHaveCount(1);
}

test("skipping an exercise can be undone after reload without losing its draft or completed results", async ({
  page,
}) => {
  await seed(page, { done: ["curl-0"], cursor: "curl-1" });
  await page.getByLabel("Weight (kg)", { exact: true }).fill("27.5");
  await page.getByLabel("Reps", { exact: true }).fill("");
  await expect
    .poll(async () => (await read(page)).active.movements[0].sets[1].reps)
    .toBe(0);
  const before = await read(page);
  await expand(page, "Workout actions");
  await page
    .getByRole("button", { name: "Skip exercise", exact: true })
    .click();
  await expect
    .poll(async () => (await read(page)).active.guided.setId)
    .toBe("bench-0");
  const skipped = await read(page);
  expect(skipped.active.movements[0].sets[0].done).toBe(true);
  expect(
    skipped.active.movements[0].sets.slice(1).every((set: any) => set.skipped),
  ).toBe(true);
  await page.reload();
  await page
    .getByRole("button", { name: "Undo last action", exact: true })
    .click();
  await expect
    .poll(async () => (await read(page)).active.guided.setId)
    .toBe("curl-1");
  expect((await read(page)).active.movements).toEqual(before.active.movements);
  await expect(page.getByLabel("Weight (kg)", { exact: true })).toHaveValue(
    "27.5",
  );
  await expect(page.getByLabel("Reps", { exact: true })).toHaveValue("");
});

test("copying last session values can be undone after reload to restore an unfinished draft", async ({
  page,
}) => {
  await seed(page, { history: true });
  await page.getByLabel("Weight (kg)", { exact: true }).fill("27.5");
  await page.getByLabel("Reps", { exact: true }).fill("");
  await expect
    .poll(async () => (await read(page)).active.movements[0].sets[0].reps)
    .toBe(0);
  const before = await read(page);
  await expand(page, "Last time");
  await page
    .getByRole("button", { name: "Use last session values", exact: true })
    .click();
  await expect(page.getByLabel("Weight (kg)", { exact: true })).toHaveValue(
    "40",
  );
  await expect(page.getByLabel("Reps", { exact: true })).toHaveValue("12");
  await expect
    .poll(async () => (await read(page)).active.movements[0].sets[0].weight)
    .toBe(40);
  await page.reload();
  await page
    .getByRole("button", { name: "Undo last action", exact: true })
    .click();
  await expect(page.getByLabel("Weight (kg)", { exact: true })).toHaveValue(
    "27.5",
  );
  await expect(page.getByLabel("Reps", { exact: true })).toHaveValue("");
  const after = await read(page);
  expect(after.active.movements).toEqual(before.active.movements);
  expect(after.workouts).toEqual(before.workouts);
  expect(after.active.guided.setId).toBe("curl-0");
});

test("default warm-up starts before working sets even when requested from set two", async ({
  page,
}) => {
  await seed(page, { done: ["curl-0"], cursor: "curl-1" });
  await page.getByLabel("Weight (kg)", { exact: true }).fill("27.5");
  await page.getByLabel("Reps", { exact: true }).fill("11");
  await expect
    .poll(async () => (await read(page)).active.movements[0].sets[1].weight)
    .toBe(27.5);
  const before = await read(page);
  await expand(page, "Workout actions");
  await page
    .getByRole("button", { name: "Add warm-up set", exact: true })
    .click();
  await expect.poll(async () => (await setIds(page)).length).toBe(4);
  const state = await read(page);
  const sets = state.active.movements[0].sets;
  expect(sets[0]).toMatchObject({ type: "warmup", done: false });
  expect(sets.slice(1)).toEqual(before.active.movements[0].sets);
  expect(state.active.guided.setId).toBe(sets[0].id);
  expect(state.active.deferredInputs["curl-1"]).toMatchObject({
    weight: "27.5",
    reps: "11",
  });
  expect(state.plans).toEqual(before.plans);
  await expect(page.getByLabel("Weight (kg)", { exact: true })).toHaveValue("");
});

test("explicit middle warm-up insertion preserves each working set and can be undone after reload", async ({
  page,
}) => {
  await seed(page, { done: ["curl-0"], cursor: "curl-1" });
  const before = await read(page);
  await expand(page, "Manage sets");
  await page
    .locator('[data-set-id="curl-1"] summary')
    .filter({ hasText: "Insert a set here" })
    .click();
  await page
    .getByRole("button", { name: "Insert warm-up after set 2", exact: true })
    .click();
  await expect.poll(async () => (await setIds(page)).length).toBe(4);
  const inserted = await read(page);
  expect(inserted.active.movements[0].sets[2]).toMatchObject({
    type: "warmup",
    done: false,
  });
  expect(
    inserted.active.movements[0].sets.filter(
      (set: any) => set.type !== "warmup",
    ),
  ).toEqual(before.active.movements[0].sets);
  await page.reload();
  await page
    .getByRole("button", { name: "Undo last action", exact: true })
    .click();
  await expect.poll(() => setIds(page)).toEqual(["curl-0", "curl-1", "curl-2"]);
  const undone = await read(page);
  expect(undone.active.movements).toEqual(before.active.movements);
  expect(undone.active.guided.setId).toBe("curl-1");
  expect(undone.plans).toEqual(before.plans);
});

test("normal warm-up insertion keeps existing leading warm-ups before the new one", async ({
  page,
}) => {
  await seed(page, { done: ["curl-0"], cursor: "curl-1", warmups: 2 });
  const before = await read(page);
  await expand(page, "Workout actions");
  await page
    .getByRole("button", { name: "Add warm-up set", exact: true })
    .click();
  await expect.poll(async () => (await setIds(page)).length).toBe(6);
  const after = await read(page);
  const sets = after.active.movements[0].sets;
  expect(sets.slice(0, 2)).toEqual(before.active.movements[0].sets.slice(0, 2));
  expect(sets[2]).toMatchObject({ type: "warmup", done: false });
  expect(sets.slice(3)).toEqual(before.active.movements[0].sets.slice(2));
  expect(after.active.guided.setId).toBe(sets[2].id);
});

test("reorder, deletion and extra sets each undo in reverse order across reload", async ({
  page,
}) => {
  await seed(page);
  const before = await read(page);
  await page
    .getByRole("button", { name: "Add another set", exact: true })
    .click();
  await expect.poll(async () => (await setIds(page)).length).toBe(4);
  const added = await setIds(page);
  await expand(page, "Manage sets");
  await page
    .getByRole("button", { name: "Move set 3 up", exact: true })
    .click();
  await expect
    .poll(() => setIds(page))
    .toEqual(["curl-0", "curl-2", "curl-1", added[3]]);
  await page.getByRole("button", { name: "Delete set 2", exact: true }).click();
  await expect.poll(() => setIds(page)).toEqual(["curl-0", "curl-1", added[3]]);
  await page.reload();
  const undo = page.getByRole("button", {
    name: "Undo last action",
    exact: true,
  });
  await undo.click();
  await expect
    .poll(() => setIds(page))
    .toEqual(["curl-0", "curl-2", "curl-1", added[3]]);
  await undo.click();
  await expect.poll(() => setIds(page)).toEqual(added);
  await undo.click();
  await expect.poll(() => setIds(page)).toEqual(["curl-0", "curl-1", "curl-2"]);
  const state = await read(page);
  expect(state.active.movements).toEqual(before.active.movements);
  expect(state.active.guided.setId).toBe("curl-0");
  expect(state.plans).toEqual(before.plans);
});

test("restart an accidentally completed earlier set keeps later results and unfinished input", async ({
  page,
}) => {
  await seed(page, { done: ["curl-0", "curl-1"], cursor: "curl-2" });
  await page.getByLabel("Weight (kg)", { exact: true }).fill("32.5");
  await page.getByLabel("Reps", { exact: true }).fill("");
  await page.getByRole("button", { name: "Edit set 1", exact: true }).click();
  await page
    .getByRole("button", { name: "Restart this set", exact: true })
    .click();
  await expect
    .poll(async () => (await read(page)).active.guided.setId)
    .toBe("curl-0");
  const state = await read(page);
  expect(state.active.movements[0].sets[0]).toMatchObject({
    done: false,
    skipped: false,
    weight: 20,
    reps: 10,
  });
  expect(state.active.movements[0].sets[1]).toMatchObject({
    done: true,
    weight: 25,
    reps: 9,
  });
  expect(state.active.deferredInputs["curl-2"]).toMatchObject({
    weight: "32.5",
    reps: "",
  });
  expect(state.timer).toBeNull();
  await page.reload();
  await expect(page.getByLabel("Weight (kg)", { exact: true })).toHaveValue(
    "20",
  );
  await page
    .getByRole("button", { name: "Complete set & start rest", exact: true })
    .click();
  await expect
    .poll(async () => (await read(page)).active.guided.setId)
    .toBe("curl-2");
  await page.getByRole("button", { name: "Skip rest", exact: true }).click();
  await expect(page.getByLabel("Weight (kg)", { exact: true })).toHaveValue(
    "32.5",
  );
  await expect(page.getByLabel("Reps", { exact: true })).toHaveValue("");
  expect((await read(page)).active.movements[0].sets[1].done).toBe(true);
});

test("deleting the current exercise's last set moves to remaining work and Undo brings it back", async ({
  page,
}) => {
  await seed(page, { singleSet: true });
  await page.getByLabel("Reps", { exact: true }).fill("");
  await expand(page, "Manage sets");
  await page.getByRole("button", { name: "Delete set 1", exact: true }).click();
  await expect
    .poll(async () => (await read(page)).active.guided.setId)
    .toBe("bench-0");
  const removed = await read(page);
  expect(removed.active.movements[0].sets).toHaveLength(0);
  expect(removed.active.deferredInputs?.["curl-0"]).toBeUndefined();
  await page.reload();
  await page
    .getByRole("button", { name: "Undo last action", exact: true })
    .click();
  await expect
    .poll(async () => (await read(page)).active.guided.setId)
    .toBe("curl-0");
  await expect(page.getByLabel("Reps", { exact: true })).toHaveValue("");
  expect((await read(page)).active.movements[0].sets).toHaveLength(1);
});

test("Undo stays available after deleting every remaining set", async ({
  page,
}) => {
  await seed(page, { singleSet: true });
  for (const expected of ["bench-0", "bench-1", undefined]) {
    await expand(page, "Manage sets");
    await page
      .getByRole("button", { name: "Delete set 1", exact: true })
      .click();
    await expect
      .poll(async () => (await read(page)).active.guided.setId)
      .toBe(expected);
  }
  await expect(
    page.getByRole("heading", { name: "Build this workout", exact: true }),
  ).toBeVisible();
  await page.reload();
  await page
    .getByRole("button", { name: "Undo last action", exact: true })
    .click();
  await expect
    .poll(async () => (await read(page)).active.guided.setId)
    .toBe("bench-1");
  await expect(page.getByLabel("Reps", { exact: true })).toHaveValue("9");
});

test("Overview set deletion uses the same durable Undo and preserves the guided draft", async ({
  page,
}) => {
  await seed(page, { done: ["curl-0"], cursor: "curl-1" });
  await page.getByLabel("Reps", { exact: true }).fill("");
  await page.getByRole("button", { name: "Overview", exact: true }).click();
  const manager = page.getByLabel("Manage sets for Barbell Curl", {
    exact: true,
  });
  await manager.locator(":scope > summary").click();
  await manager
    .getByRole("button", { name: "Delete set 1", exact: true })
    .click();
  await expect.poll(() => setIds(page)).toEqual(["curl-1", "curl-2"]);
  await page.reload();
  await page
    .getByRole("button", { name: "Undo last action", exact: true })
    .click();
  await expect.poll(() => setIds(page)).toEqual(["curl-0", "curl-1", "curl-2"]);
  expect((await read(page)).active.movements[0].sets[0].done).toBe(true);
  await page
    .getByRole("button", { name: "Back to guided workout", exact: true })
    .click();
  await expect(page.getByLabel("Reps", { exact: true })).toHaveValue("");
  expect((await read(page)).active.guided.setId).toBe("curl-1");
});

test("accidental finish can be undone after reload with draft, rest and plan position restored", async ({
  page,
}) => {
  await seed(page, { done: ["curl-0"], cursor: "curl-1", rest: true });
  const before = await read(page);
  await finishEarly(page);
  await expect.poll(async () => (await read(page)).plans[0].next).toBe(1);
  await page.reload();
  await page
    .getByRole("button", { name: "Undo finish workout", exact: true })
    .click();
  await expect
    .poll(async () => (await read(page)).active?.id)
    .toBe("workout-recovery");
  const recovered = await read(page);
  expect(recovered.workouts).toHaveLength(0);
  expect(recovered.active.movements).toEqual(before.active.movements);
  expect(recovered.active.notes).toBe(before.active.notes);
  expect(recovered.active.guided).toEqual(before.active.guided);
  expect(recovered.plans[0].next).toBe(0);
  expect(recovered.timer - Date.now()).toBeGreaterThan(75000);
  await page.getByRole("button", { name: "Skip rest", exact: true }).click();
  await expect(page.getByLabel("Reps", { exact: true })).toHaveValue("");
  await finishEarly(page);
  expect((await read(page)).workouts).toHaveLength(1);
});

test("an accidentally discarded workout restores its draft and rest after reload", async ({
  page,
}) => {
  await seed(page, { done: ["curl-0"], cursor: "curl-1", rest: true });
  await page.getByRole("button", { name: "Overview", exact: true }).click();
  await expect
    .poll(async () => (await read(page)).active.guided.overview)
    .toBe(true);
  const before = await read(page);
  await page
    .getByRole("button", { name: "Discard workout", exact: true })
    .click();
  await page.getByRole("button", { name: "Confirm", exact: true }).click();
  await expect.poll(async () => (await read(page)).active).toBeNull();
  await page.reload();
  await page
    .getByRole("button", { name: "Undo discard workout", exact: true })
    .click();
  await expect
    .poll(async () => (await read(page)).active?.id)
    .toBe("workout-recovery");
  const recovered = await read(page);
  expect(recovered.active.movements).toEqual(before.active.movements);
  expect(recovered.active.guided).toEqual(before.active.guided);
  expect(recovered.active.deferredInputs).toEqual(before.active.deferredInputs);
  expect(recovered.timer - Date.now()).toBeGreaterThan(75000);
  expect(recovered.workouts).toHaveLength(0);
  expect(recovered.plans).toEqual(before.plans);
  await page
    .getByRole("button", { name: "Back to guided workout", exact: true })
    .click();
  await page.getByRole("button", { name: "Skip rest", exact: true }).click();
  await expect(page.getByLabel("Reps", { exact: true })).toHaveValue("");
});

test("a deleted history workout can be restored after reload without becoming active", async ({
  page,
}) => {
  await seed(page, { done: ["curl-0"], cursor: "curl-1" });
  await finishEarly(page);
  const before = await read(page);
  await page
    .locator(".history-card")
    .getByRole("button", { name: /^View & edit/ })
    .click();
  await page
    .getByRole("button", { name: "Delete workout", exact: true })
    .click();
  await page.getByRole("button", { name: "Confirm", exact: true }).click();
  await expect.poll(async () => (await read(page)).workouts.length).toBe(0);
  await page.reload();
  await page
    .getByRole("button", { name: "Undo delete workout", exact: true })
    .click();
  await expect(page.locator(".history-card")).toHaveCount(1);
  const recovered = await read(page);
  expect(recovered.workouts).toEqual(before.workouts);
  expect(recovered.active).toBeNull();
  expect(recovered.timer).toBeNull();
  expect(recovered.plans).toEqual(before.plans);
});

test("reopening history resumes unfinished sets without duplicating completed workout history", async ({
  page,
}) => {
  await seed(page, { done: ["curl-0"], cursor: "curl-1" });
  await finishEarly(page);
  await page.reload();
  await page
    .locator(".history-card")
    .getByRole("button", { name: "Reopen workout", exact: true })
    .click();
  await expect
    .poll(async () => (await read(page)).active?.id)
    .toBe("workout-recovery");
  const recovered = await read(page);
  expect(recovered.workouts).toHaveLength(0);
  expect(recovered.active.movements[0].sets[0].done).toBe(true);
  expect(recovered.active.guided.setId).toBe("curl-1");
  expect(recovered.active.finished).toBeUndefined();
  await expect(page.getByLabel("Reps", { exact: true })).toHaveValue("9");
  await finishEarly(page);
  const finished = await read(page);
  expect(finished.workouts).toHaveLength(1);
  expect(finished.workouts[0].id).toBe("workout-recovery");
  expect(finished.plans[0].next).toBe(1);
});

test("reopening an old workout never replaces another active session", async ({
  page,
}) => {
  await seed(page, { done: ["curl-0"], cursor: "curl-1" });
  await finishEarly(page);
  await page.goto("#workout");
  await page
    .getByRole("button", { name: "Start empty workout", exact: true })
    .click();
  await expect
    .poll(async () => (await read(page)).active?.id)
    .not.toBe("workout-recovery");
  await expect.poll(async () => (await read(page)).active?.id).toBeTruthy();
  const before = await read(page);
  await page.goto("#history");
  await page
    .locator(".history-card")
    .getByRole("button", { name: "Reopen workout", exact: true })
    .click();
  await expect(
    page.getByText(
      "Finish or discard your current workout before reopening this session. Both workouts have been kept.",
      { exact: true },
    ),
  ).toBeVisible();
  const after = await read(page);
  expect(after.active).toEqual(before.active);
  expect(after.workouts).toEqual(before.workouts);
});

test("repeated completion taps log one set and Undo keeps the original entry", async ({
  page,
}) => {
  await seed(page);
  await page.getByLabel("Weight (kg)", { exact: true }).fill("22.5");
  await page.getByLabel("Reps", { exact: true }).fill("9");
  await page
    .getByRole("button", { name: "Complete set & start rest", exact: true })
    .evaluate((button: HTMLElement) => {
      button.click();
      button.click();
    });
  await expect
    .poll(async () => (await read(page)).active.movements[0].sets[0].done)
    .toBe(true);
  const state = await read(page);
  expect(
    state.active.movements
      .flatMap((movement: any) => movement.sets)
      .filter((set: any) => set.done),
  ).toHaveLength(1);
  expect(state.active.guided.setId).toBe("curl-1");
  await page
    .getByRole("button", { name: "Undo last action", exact: true })
    .click();
  await expect
    .poll(async () => (await read(page)).active.guided.setId)
    .toBe("curl-0");
  await expect(page.getByLabel("Weight (kg)", { exact: true })).toHaveValue(
    "22.5",
  );
  await expect(page.getByLabel("Reps", { exact: true })).toHaveValue("9");
  expect((await read(page)).active.movements[0].sets[0].done).toBe(false);
});

test("dragging sets and keyboard reordering retain set identities and the selected entry", async ({
  page,
}) => {
  await seed(page, { done: ["curl-0"], cursor: "curl-1" });
  const before = await read(page);
  await expand(page, "Manage sets");
  await page
    .getByRole("button", { name: "Drag set 3", exact: true })
    .dragTo(page.getByRole("button", { name: "Drag set 1", exact: true }));
  await expect.poll(() => setIds(page)).toEqual(["curl-2", "curl-0", "curl-1"]);
  expect((await read(page)).active.guided.setId).toBe("curl-1");
  await page
    .getByRole("button", { name: "Undo last action", exact: true })
    .click();
  await expect.poll(() => setIds(page)).toEqual(["curl-0", "curl-1", "curl-2"]);
  await expand(page, "Manage sets");
  const handle = page.getByRole("button", { name: "Drag set 3", exact: true });
  await handle.focus();
  await page.keyboard.press("ArrowUp");
  await expect.poll(() => setIds(page)).toEqual(["curl-0", "curl-2", "curl-1"]);
  const state = await read(page);
  expect(state.active.guided.setId).toBe("curl-1");
  expect(
    state.active.movements[0].sets.find((set: any) => set.id === "curl-0"),
  ).toEqual(before.active.movements[0].sets[0]);
  expect(state.plans).toEqual(before.plans);
});

test.describe("touch set reordering", () => {
  test.use({ hasTouch: true, viewport: { width: 390, height: 900 } });

  test("touch pointer dragging moves a set and can be undone", async ({
    page,
    context,
  }) => {
    await seed(page);
    await expand(page, "Manage sets");
    const source = page.getByRole("button", {
      name: "Drag set 3",
      exact: true,
    });
    const target = page.getByRole("button", {
      name: "Drag set 1",
      exact: true,
    });
    await page
      .locator(".set-manager")
      .evaluate((manager) => manager.scrollIntoView({ block: "start" }));
    await source.scrollIntoViewIfNeeded();
    await target.scrollIntoViewIfNeeded();
    const sourceBox = (await source.boundingBox())!;
    const targetBox = (await target.boundingBox())!;
    const start = {
      x: sourceBox.x + sourceBox.width / 2,
      y: sourceBox.y + sourceBox.height / 2,
    };
    const end = {
      x: targetBox.x + targetBox.width / 2,
      y: targetBox.y + targetBox.height / 2,
    };
    expect(start.y).toBeGreaterThan(0);
    expect(start.y).toBeLessThan(900);
    expect(end.y).toBeGreaterThan(0);
    expect(end.y).toBeLessThan(900);
    const actionBar = (await page.locator(".guided-action-bar").boundingBox())!;
    expect(sourceBox.y + sourceBox.height).toBeLessThanOrEqual(actionBar.y);
    expect(targetBox.y + targetBox.height).toBeLessThanOrEqual(actionBar.y);
    expect(
      await page.evaluate(
        ({ x, y }) =>
          document
            .elementFromPoint(x, y)
            ?.closest("button")
            ?.getAttribute("aria-label"),
        start,
      ),
    ).toBe("Drag set 3");
    const session = await context.newCDPSession(page);
    await session.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ ...start, id: 1 }],
    });
    for (let index = 1; index <= 5; index++)
      await session.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [
          {
            x: start.x + ((end.x - start.x) * index) / 5,
            y: start.y + ((end.y - start.y) * index) / 5,
            id: 1,
          },
        ],
      });
    await session.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
    await session.detach();
    await expect
      .poll(() => setIds(page))
      .toEqual(["curl-2", "curl-0", "curl-1"]);
    await page
      .getByRole("button", { name: "Undo last action", exact: true })
      .click();
    await expect
      .poll(() => setIds(page))
      .toEqual(["curl-0", "curl-1", "curl-2"]);
  });
});
