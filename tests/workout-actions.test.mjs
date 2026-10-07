import { test } from "node:test";
import assert from "node:assert/strict";
import { validateBackup } from "../src/domain.mjs";
import {
  workoutQueue,
  currentStep,
  nextStep,
  guideSet,
  beginCorrection,
  saveCorrection,
  cancelCorrection,
  pauseWorkout,
  resumeWorkout,
  rememberSetUndo,
  skipCurrentSet,
  undoLastSet,
  cleanWorkoutProgress,
  syncEditedInputs,
} from "../src/workout-actions.mjs";

function session() {
  const movements = ["a", "b"].map((id) => ({
    id,
    exerciseId: id,
    rest: 90,
    notes: "",
    superset: "",
    repMin: 8,
    repMax: 12,
    sets: [0, 1, 2].map((index) => ({
      id: id + index,
      weight: 20,
      reps: 10,
      seconds: 60,
      distance: 0,
      type: "working",
      done: false,
    })),
  }));
  return {
    version: 1,
    plans: [],
    workouts: [],
    active: {
      id: "workout",
      name: "Workout",
      started: "2026-10-08T10:00:00Z",
      notes: "",
      movements,
      guided: { setId: "a0", phase: "entry", overview: false },
    },
    body: [],
    equipment: [],
    custom: [],
    favourites: [],
    exerciseNotes: {},
    setupNotes: {},
    settings: { weight: "kg", length: "cm", distance: "km", effort: "off" },
    timer: null,
  };
}
const getSet = (state, setId) =>
  state.active.movements.flatMap((m) => m.sets).find((s) => s.id === setId);

test("exercise order finishes each exercise; circuit order alternates grouped rounds", () => {
  const state = session();
  state.active.movements.forEach((m) => (m.superset = "pair"));
  assert.deepEqual(
    workoutQueue(state.active.movements).map((s) => s.set.id),
    ["a0", "a1", "a2", "b0", "b1", "b2"],
  );
  assert.deepEqual(
    workoutQueue(state.active.movements, "circuit").map((s) => s.set.id),
    ["a0", "b0", "a1", "b1", "a2", "b2"],
  );
});

test("navigation retains unfinished raw input and revives only the selected skipped set", () => {
  const state = session();
  state.active.guided.draft = {
    setId: "a0",
    values: { weight: "27.", reps: "" },
  };
  state.timer = 200000;
  assert.equal(guideSet(state, "b0"), true);
  assert.deepEqual(state.active.deferredInputs.a0, { weight: "27.", reps: "" });
  assert.equal(currentStep(state.active).set.id, "b0");
  assert.equal(state.timer, null);
  getSet(state, "a1").skipped = true;
  getSet(state, "a2").skipped = true;
  assert.equal(guideSet(state, "a1"), true);
  assert.equal(getSet(state, "a1").skipped, false);
  assert.equal(getSet(state, "a2").skipped, true);
  assert.equal(guideSet(state, "missing"), false);
  getSet(state, "a0").done = true;
  assert.equal(guideSet(state, "a0"), false);
  assert.doesNotThrow(() => validateBackup(state));
});

test("a selected later exercise keeps its sets together and wraps to earlier pending exercises", () => {
  const state = session();
  guideSet(state, "b0");
  getSet(state, "b0").done = true;
  assert.equal(nextStep(state.active, "b0").set.id, "b1");
  state.active.guided = { setId: "b1", phase: "entry" };
  skipCurrentSet(state, 100000);
  assert.equal(currentStep(state.active).set.id, "b2");
  getSet(state, "b2").done = true;
  assert.equal(nextStep(state.active, "b2").set.id, "a0");
  // If someone jumps to the last set, finish earlier sets of that exercise too.
  getSet(state, "b0").done = false;
  assert.equal(nextStep(state.active, "b2").set.id, "b0");
  state.active.setOrder = "circuit";
  state.active.movements.forEach((m) => (m.superset = "pair"));
  getSet(state, "b1").skipped = false;
  assert.equal(nextStep(state.active, "b0").set.id, "a1");
  state.active.movements.forEach((m) =>
    m.sets.forEach((set) => (set.done = true)),
  );
  getSet(state, "b2").done = false;
  assert.equal(nextStep(state.active, "b2"), undefined);
});

test("completed correction preserves the completed count and resumes previous draft and remaining rest", () => {
  const state = session();
  getSet(state, "a0").done = true;
  state.active.guided = {
    setId: "a1",
    phase: "rest",
    lastSetId: "a0",
    overview: false,
    draft: { setId: "a1", values: { weight: "30.", reps: "" } },
  };
  const before = structuredClone(state.active.guided);
  state.timer = 190000;
  assert.equal(beginCorrection(state, "a0", 100000), true);
  assert.equal(currentStep(state.active).set.id, "a0");
  assert.equal(getSet(state, "a0").done, true);
  assert.equal(state.timer, null);
  getSet(state, "a0").weight = 25;
  getSet(state, "a0").reps = 11;
  const reloaded = validateBackup(JSON.parse(JSON.stringify(state)));
  assert.equal(saveCorrection(reloaded, 160000), true);
  assert.equal(getSet(reloaded, "a0").weight, 25);
  assert.equal(getSet(reloaded, "a0").reps, 11);
  assert.equal(getSet(reloaded, "a0").done, true);
  assert.deepEqual(reloaded.active.guided, before);
  assert.equal(reloaded.timer, 250000);
  assert.deepEqual(reloaded.active.deferredInputs.a1, before.draft.values);
  assert.equal(getSet(reloaded, "a1").weight, 20);
});

test("cancel correction after reload restores original optional fields and exact prior position", () => {
  const state = session();
  const target = getSet(state, "a0");
  target.done = true;
  target.effort = 2;
  target.effortKind = "RIR";
  const original = structuredClone(target);
  state.active.guided = { setId: "b0", phase: "entry", overview: true };
  const before = structuredClone(state.active.guided);
  assert.equal(beginCorrection(state, "a0", 100000), true);
  target.weight = 40;
  target.reps = 0;
  target.type = "drop";
  delete target.effort;
  target.effortKind = "RPE";
  state.active.guided.draft = { setId: "a0", values: { weight: "" } };
  state.active.deferredInputs = { a0: { weight: "" }, b1: { reps: "8" } };
  const reloaded = validateBackup(JSON.parse(JSON.stringify(state)));
  assert.equal(cancelCorrection(reloaded, 160000), true);
  assert.deepEqual(getSet(reloaded, "a0"), original);
  assert.deepEqual(reloaded.active.guided, before);
  assert.equal(reloaded.active.deferredInputs.a0, undefined);
  assert.deepEqual(reloaded.active.deferredInputs.b1, { reps: "8" });
  assert.equal(reloaded.timer, null);
});

test("correction refuses nested edits and saving a blank load", () => {
  const state = session();
  getSet(state, "a0").done = true;
  getSet(state, "a1").done = true;
  assert.equal(beginCorrection(state, "a0", 100000), true);
  assert.equal(beginCorrection(state, "a1", 100000), false);
  assert.equal(guideSet(state, "b0"), false);
  state.active.guided.draft = { setId: "a0", values: { weight: "" } };
  assert.equal(saveCorrection(state), false);
  assert.equal(getSet(state, "a0").done, true);
  assert.equal(cancelCorrection(state), true);
});

test("correction opens the saved result even when old raw text remains and cancel restores that text", () => {
  const state = session();
  getSet(state, "a0").done = true;
  state.active.deferredInputs = { a0: { weight: "old" }, a1: { reps: "8" } };
  state.active.guided = {
    setId: "a1",
    phase: "entry",
    draft: { setId: "a1", values: { reps: "9" } },
  };
  beginCorrection(state, "a0", 100000);
  assert.equal(state.active.deferredInputs.a0, undefined);
  assert.deepEqual(state.active.deferredInputs.a1, { reps: "9" });
  getSet(state, "a0").weight = 35;
  cancelCorrection(state, 200000);
  assert.equal(getSet(state, "a0").weight, 20);
  assert.deepEqual(state.active.deferredInputs.a0, { weight: "old" });
  assert.deepEqual(state.active.deferredInputs.a1, { reps: "9" });
  assert.deepEqual(state.active.guided.draft.values, { reps: "9" });
});

test("pause survives reload and rebases the frozen timer without allowing actions", () => {
  const state = session();
  state.active.guided.phase = "rest";
  state.active.guided.draft = { setId: "a0", values: { reps: "" } };
  state.timer = 190000;
  assert.equal(pauseWorkout(state, 100000), true);
  assert.equal(state.timer, null);
  assert.equal(state.active.pausedRestMs, 90000);
  assert.equal(pauseWorkout(state, 130000), false);
  const reloaded = validateBackup(JSON.parse(JSON.stringify(state)));
  assert.equal(guideSet(reloaded, "b0"), false);
  assert.equal(skipCurrentSet(reloaded, 130000), false);
  assert.equal(rememberSetUndo(reloaded, "a0"), false);
  assert.equal(resumeWorkout(reloaded, 1000000), true);
  assert.equal(reloaded.timer, 1090000);
  assert.equal(reloaded.active.pausedAt, undefined);
  assert.equal(reloaded.active.pausedRestMs, undefined);
  assert.deepEqual(reloaded.active.guided.draft.values, { reps: "" });
  assert.equal(resumeWorkout(reloaded), false);
  const noTimer = session();
  assert.equal(pauseWorkout(noTimer, 100000), true);
  assert.equal(resumeWorkout(noTimer, 200000), true);
  assert.equal(noTimer.timer, null);
});

test("skip targets one set, persists undo, and undo preserves unrelated edits and added sets", () => {
  const state = session();
  state.active.guided.draft = { setId: "a0", values: { weight: "27." } };
  assert.equal(skipCurrentSet(state, 100000), true);
  assert.equal(getSet(state, "a0").skipped, true);
  assert.equal(getSet(state, "a1").skipped, undefined);
  assert.equal(getSet(state, "a2").skipped, undefined);
  assert.equal(currentStep(state.active).set.id, "a1");
  assert.equal(state.active.guided.undo.kind, "skip");
  const reloaded = validateBackup(JSON.parse(JSON.stringify(state)));
  getSet(reloaded, "b1").weight = 45;
  reloaded.active.movements[0].sets.push({
    ...getSet(reloaded, "a2"),
    id: "a3",
  });
  assert.equal(guideSet(reloaded, "b0"), true);
  reloaded.active.guided.draft = { setId: "b0", values: { reps: "9" } };
  assert.equal(undoLastSet(reloaded, 200000), true);
  assert.equal(getSet(reloaded, "a0").skipped, undefined);
  assert.equal(currentStep(reloaded.active).set.id, "a0");
  assert.equal(getSet(reloaded, "b1").weight, 45);
  assert.ok(getSet(reloaded, "a3"));
  assert.deepEqual(reloaded.active.deferredInputs.b0, { reps: "9" });
  assert.deepEqual(reloaded.active.guided.draft.values, { weight: "27." });
  assert.equal(reloaded.active.guided.undo, undefined);
  assert.equal(undoLastSet(reloaded), false);
});

test("the next completion or skip replaces undo and restores deferred fields removed by completion", () => {
  const state = session();
  state.active.deferredInputs = { a0: { reps: "10" } };
  assert.equal(rememberSetUndo(state, "a0", "complete", 100000), true);
  let undo = state.active.guided.undo;
  getSet(state, "a0").done = true;
  delete state.active.deferredInputs.a0;
  state.active.guided = { setId: "a1", phase: "rest", undo };
  assert.equal(undoLastSet(state, 200000), true);
  assert.deepEqual(state.active.deferredInputs.a0, { reps: "10" });
  assert.equal(rememberSetUndo(state, "a0", "complete", 300000), true);
  undo = state.active.guided.undo;
  getSet(state, "a0").done = true;
  state.active.guided = { setId: "a1", phase: "entry", undo };
  assert.equal(skipCurrentSet(state, 300000), true);
  assert.equal(state.active.guided.undo.setId, "a1");
  assert.equal(state.active.guided.undo.kind, "skip");
  assert.equal(undoLastSet(state, 400000), true);
  assert.equal(getSet(state, "a0").done, true);
  assert.equal(getSet(state, "a1").skipped, undefined);
});

test("backup accepts older workouts and rejects malformed pause, correction, and undo metadata", () => {
  assert.doesNotThrow(() => validateBackup(session()));
  const state = session();
  getSet(state, "a0").done = true;
  assert.equal(beginCorrection(state, "a0", 100000), true);
  assert.doesNotThrow(() => validateBackup(state));
  for (const corrupt of [
    (s) => (s.active.pausedAt = "today"),
    (s) => (s.active.pausedRestMs = 30000),
    (s) => (s.active.guided.editing.remainingRestMs = -1),
    (s) => (s.active.guided.editing.original.id = "other"),
    (s) => (s.active.guided.editing.original.done = false),
    (s) => (s.active.guided.editing.returnGuided.phase = "bad"),
    (s) => (s.active.guided.editing.returnGuided.undo = {}),
    (s) => (s.active.guided.editing.deferredValues = { unknown: "5" }),
  ]) {
    const bad = structuredClone(state);
    corrupt(bad);
    assert.throws(() => validateBackup(bad), /Invalid workout records/);
  }
  const paused = session();
  pauseWorkout(paused, 100000);
  paused.timer = 200000;
  assert.throws(() => validateBackup(paused), /paused workout/);
  const undoState = session();
  skipCurrentSet(undoState, 100000);
  undoState.active.guided.undo.kind = "delete";
  assert.throws(() => validateBackup(undoState), /Invalid workout records/);
});

test("removing a set cleans its transient references and leaves unrelated drafts intact", () => {
  const state = session();
  state.active.deferredInputs = { a0: { weight: "20" }, b0: { reps: "8" } };
  skipCurrentSet(state, 100000);
  state.active.guided.draft = { setId: "a0", values: { weight: "20" } };
  state.active.movements[0].sets.shift();
  cleanWorkoutProgress(state.active);
  assert.equal(state.active.guided.undo, undefined);
  assert.equal(state.active.guided.draft, undefined);
  assert.equal(state.active.deferredInputs.a0, undefined);
  assert.deepEqual(state.active.deferredInputs.b0, { reps: "8" });
  assert.doesNotThrow(() => validateBackup(state));

  getSet(state, "a1").done = true;
  beginCorrection(state, "a1", 100000);
  state.active.movements[0].sets.shift();
  cleanWorkoutProgress(state.active);
  assert.equal(state.active.guided.editing, undefined);
  assert.doesNotThrow(() => validateBackup(state));
});

test("overview edits clear changed raw fields while preserving other unfinished text", () => {
  const state = session();
  state.active.guided.draft = {
    setId: "a0",
    values: { weight: "20.", reps: "", effort: "2" },
  };
  state.active.deferredInputs = {
    a0: { weight: "20.", reps: "" },
    b0: { weight: "30." },
  };
  const before = structuredClone(state.active.movements);
  getSet(state, "a0").weight = 25;
  state.active.movements[0].notes = "New seat setting";
  getSet(state, "a0").type = "warmup";
  syncEditedInputs(state.active, before);
  assert.deepEqual(state.active.guided.draft.values, { reps: "", effort: "2" });
  assert.deepEqual(state.active.deferredInputs.a0, { reps: "" });
  assert.deepEqual(state.active.deferredInputs.b0, { weight: "30." });
  const beforeReps = structuredClone(state.active.movements);
  getSet(state, "a0").reps = 8;
  getSet(state, "a0").effort = 3;
  syncEditedInputs(state.active, beforeReps);
  assert.equal(state.active.guided.draft, undefined);
  assert.equal(state.active.deferredInputs.a0, undefined);
});
