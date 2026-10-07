import { test } from "node:test";
import assert from "node:assert/strict";
import {
  activePlan,
  postpone,
  weightIncrement,
  saveIncrement,
  switchWeightUnit,
} from "../src/mobile.mjs";
import { validateBackup } from "../src/domain.mjs";
import {
  rememberSetUndo,
  beginCorrection,
  cancelCorrection,
} from "../src/workout-actions.mjs";

const state = () => ({
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
const movement = (id, superset = "") => ({
  id,
  exerciseId: "Barbell_Curl",
  sets: [0, 1].map((i) => ({
    id: id + i,
    weight: 20,
    reps: 10,
    seconds: 60,
    distance: 0,
    type: "working",
    done: false,
  })),
  rest: 90,
  notes: "",
  superset,
  repMin: 8,
  repMax: 12,
});
test("active plan falls back for old, deleted and empty choices without changing plan order", () => {
  const s = state();
  const empty = { id: "empty", name: "Empty", next: 0, days: [] };
  s.plans = [
    empty,
    {
      id: "a",
      name: "A",
      next: 0,
      days: [{ id: "day", name: "Day", movements: [] }],
    },
    {
      id: "b",
      name: "B",
      next: 0,
      days: [{ id: "day-b", name: "Day", movements: [] }],
    },
  ];
  assert.equal(activePlan(s).id, "a");
  s.settings.activePlanId = "b";
  assert.equal(activePlan(s).id, "b");
  s.settings.activePlanId = "empty";
  assert.equal(activePlan(s).id, "a");
  s.settings.activePlanId = "deleted";
  assert.equal(activePlan(s).id, "a");
  assert.deepEqual(
    s.plans.map((p) => p.id),
    ["empty", "a", "b"],
  );
});
test("increments retain physical and stack conventions across units and backup", () => {
  const s = state();
  const physical = { id: "bar", loadKind: "per-side" },
    stack = { id: "stack", loadKind: "stack" };
  assert.equal(weightIncrement(s, physical), 2.5);
  s.settings.weight = "lb";
  assert.equal(weightIncrement(s, physical), 5);
  saveIncrement(s, physical, 5);
  saveIncrement(s, stack, 2);
  s.settings.weight = "kg";
  assert.ok(Math.abs(weightIncrement(s, physical) - 2.26796185) < 0.001);
  assert.equal(weightIncrement(s, stack), 2);
  s.settings.keepAwake = true;
  s.settings.activePlanId = "missing";
  assert.deepEqual(validateBackup(s).settings, s.settings);
  for (const bad of [0, -1, Infinity, "2"]) {
    const x = structuredClone(s);
    x.settings.weightIncrements.bar = bad;
    assert.throws(() => validateBackup(x), /Invalid settings/);
  }
  const bad = state();
  bad.settings.keepAwake = "yes";
  assert.throws(() => validateBackup(bad), /Invalid settings/);
});
test("postponement preserves partial rounds and raw input, and refuses a final group", () => {
  const s = state();
  s.active = {
    id: "work",
    name: "Workout",
    started: "2026-10-06T01:00:00Z",
    notes: "",
    setOrder: "circuit",
    movements: [movement("a", "A"), movement("b", "A"), movement("c")],
    guided: {
      phase: "entry",
      setId: "a1",
      draft: { setId: "a1", values: { weight: "22.5", reps: "" } },
    },
  };
  s.active.movements[0].sets[0].done = true;
  assert.equal(postpone(s.active, "a"), true);
  assert.deepEqual(
    s.active.movements.map((m) => m.id),
    ["c", "a", "b"],
  );
  assert.equal(s.active.movements[1].sets[0].done, true);
  assert.deepEqual(s.active.deferredInputs.a1, { weight: "22.5", reps: "" });
  assert.deepEqual(validateBackup(s).active, s.active);
  s.active.movements[0].sets.forEach((t) => {
    t.done = true;
  });
  const before = structuredClone(s.active);
  assert.equal(postpone(s.active, "a"), false);
  assert.deepEqual(s.active, before);
  const bad = structuredClone(s);
  bad.active.deferredInputs.a1.invalid = "0";
  assert.throws(() => validateBackup(bad), /Invalid workout/);
});

test("postponement in exercise order moves one exercise and retains completion undo", () => {
  const s = state();
  s.active = {
    id: "work",
    name: "Workout",
    started: "2026-10-06T01:00:00Z",
    notes: "",
    movements: [movement("a", "A"), movement("b", "A"), movement("c")],
    guided: { phase: "entry", setId: "a0" },
  };
  rememberSetUndo(s, "a0", "complete", 100000);
  s.active.movements[0].sets[0].done = true;
  s.active.guided = { phase: "entry", setId: "a1", undo: s.active.guided.undo };
  const undo = structuredClone(s.active.guided.undo);
  assert.equal(postpone(s.active, "a"), true);
  assert.deepEqual(
    s.active.movements.map((m) => m.id),
    ["b", "c", "a"],
  );
  assert.deepEqual(s.active.guided.undo, undo);
  assert.doesNotThrow(() => validateBackup(s));
  s.active.pausedAt = 100000;
  assert.equal(postpone(s.active, "b"), false);
});
test("switching units converts unfinished input but preserves blank and stack entries", () => {
  const s = state();
  s.active = {
    movements: [movement("a"), movement("b")],
    guided: { draft: { setId: "a0", values: { weight: "20", reps: "" } } },
    deferredInputs: { b0: { weight: "20" }, b1: { weight: "" } },
  };
  s.active.movements[1].exerciseId = "stack";
  switchWeightUnit(s, "lb", (id) => ({
    id,
    loadKind: id === "stack" ? "stack" : "plates",
  }));
  assert.equal(s.active.guided.draft.values.weight, "44.09");
  assert.equal(s.active.guided.draft.values.reps, "");
  assert.equal(s.active.deferredInputs.b0.weight, "20");
  assert.equal(s.active.deferredInputs.b1.weight, "");
  assert.equal(s.active.movements[0].sets[0].weight, 20);
});

test("switching units converts saved return drafts and original correction input before cancel", () => {
  const s = state();
  s.active = {
    id: "work",
    name: "Workout",
    started: "2026-10-06T01:00:00Z",
    notes: "",
    movements: [movement("a")],
    guided: {
      setId: "a1",
      phase: "entry",
      draft: { setId: "a1", values: { weight: "20", reps: "" } },
    },
    deferredInputs: { a0: { weight: "20" } },
  };
  s.active.movements[0].sets[0].done = true;
  beginCorrection(s, "a0", 100000);
  s.active.movements[0].sets[0].weight = 25;
  switchWeightUnit(s, "lb", (id) => ({ id, loadKind: "plates" }));
  assert.equal(
    s.active.guided.editing.returnGuided.draft.values.weight,
    "44.09",
  );
  assert.equal(s.active.guided.editing.deferredValues.weight, "44.09");
  cancelCorrection(s, 200000);
  assert.equal(s.active.guided.draft.values.weight, "44.09");
  assert.equal(s.active.guided.draft.values.reps, "");
  assert.equal(s.active.movements[0].sets[0].weight, 20);
  assert.equal(s.active.deferredInputs.a0.weight, "44.09");
});
