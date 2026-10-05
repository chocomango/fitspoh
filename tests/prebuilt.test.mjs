import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  installPersonalPlan,
  makePersonalPlan,
} from "../src/prebuilt-plan.mjs";
import {
  validateBackup,
  volume,
  displayLoad,
  storedLoad,
  loadUnit,
} from "../src/domain.mjs";
const library = JSON.parse(
  fs.readFileSync(new URL("../src/data/exercises.json", import.meta.url)),
);
const baseline = () => ({
  version: 1,
  plans: [],
  workouts: [],
  active: null,
  body: [],
  equipment: [],
  custom: [],
  favourites: [],
  exerciseNotes: {},
  setupNotes: {},
  settings: { weight: "kg", length: "cm", distance: "km", effort: "off" },
  timer: null,
});

test("personal plan preserves the supplied sequence, weights, conventions, and history notes", () => {
  const s = baseline();
  const id = installPersonalPlan(s);
  const p = s.plans[0];
  assert.equal(p.id, id);
  assert.equal(p.days.length, 7);
  assert.deepEqual(
    p.days.map((d) => !!d.restDay),
    [false, false, true, false, false, false, true],
  );
  assert.deepEqual(
    p.days[0].movements[0].sets.map((x) => [x.weight, x.reps]),
    [
      [27.5, 9],
      [27.5, 10],
      [27.5, 8],
    ],
  );
  assert.equal(p.days[0].movements[2].sets[0].weight, 63.75);
  assert.equal(p.days[1].movements[0].sets[0].weight, 95);
  assert.equal(p.days[1].movements[1].sets[0].weight, 40);
  assert.equal(p.days[5].movements[1].sets[0].weight, 70);
  assert.match(p.days[5].movements[1].notes, /80 kg/);
  assert.match(p.days[1].movements[2].notes, /53 kg/);
  assert.match(p.notes, /not a fixed calendar/);
  assert.equal(p.days[0].movements.at(-1).optional, true);
  assert.equal(p.days[4].movements.at(-1).optional, false);
  assert.equal(s.workouts.length, 0);
  assert.doesNotThrow(() =>
    validateBackup(
      s,
      library.map((e) => e.id),
    ),
  );
  p.days[0].movements[0].sets[0].weight = 28;
  assert.equal(installPersonalPlan(s), id);
  assert.equal(s.plans.length, 1);
  assert.equal(p.days[0].movements[0].sets[0].weight, 28);
  assert.notEqual(makePersonalPlan().id, id);
});

test("stack settings never convert to pounds; partial loads are excluded from total-load volume", () => {
  const s = baseline();
  installPersonalPlan(s);
  const stack = s.custom.find((e) => e.loadKind === "stack");
  assert.equal(displayLoad(30, "lb", stack), 30);
  assert.equal(storedLoad(30, "lb", stack), 30);
  assert.equal(loadUnit("lb", stack), "stack setting");
  const movements = s.plans[0].days
    .flatMap((d) => d.movements)
    .filter((m) => s.custom.find((e) => e.id === m.exerciseId)?.loadKind);
  movements.forEach((m) =>
    m.sets.forEach((t) => {
      t.done = true;
    }),
  );
  assert.equal(
    volume({ movements }, (id) => s.custom.find((e) => e.id === id)),
    0,
  );
  const bad = structuredClone(s);
  bad.custom[0].loadKind = "total-guessed";
  assert.throws(() => validateBackup(bad), /Invalid custom/);
});
