import { test } from "node:test";
import assert from "node:assert/strict";
import { validateBackup } from "../src/domain.mjs";
import {
  finishWorkoutState,
  reopenWorkout,
  removeWorkout,
  restoreRemovedWorkout,
} from "../src/workout-history.mjs";
import {
  currentStep,
  recordWorkoutAction,
  undoWorkoutAction,
} from "../src/workout-actions.mjs";

const finishedAt = Date.parse("2026-10-08T10:30:00Z");
function session() {
  const movement = {
    id: "movement",
    exerciseId: "exercise",
    rest: 90,
    notes: "",
    superset: "",
    repMin: 8,
    repMax: 12,
    sets: [0, 1, 2].map((index) => ({
      id: `set-${index}`,
      weight: 20,
      reps: 10,
      seconds: 60,
      distance: 0,
      type: "working",
      done: index === 0,
    })),
  };
  return {
    version: 1,
    plans: [
      {
        id: "plan",
        name: "Training",
        next: 0,
        days: [
          {
            id: "day-0",
            name: "Upper",
            movements: [structuredClone(movement)],
          },
          { id: "day-1", name: "Lower", movements: [] },
        ],
      },
    ],
    workouts: [],
    active: {
      id: "workout",
      name: "Upper",
      started: "2026-10-08T10:00:00Z",
      notes: "Good day",
      planId: "plan",
      dayId: "day-0",
      movements: [movement],
      guided: {
        setId: "set-1",
        lastSetId: "set-0",
        phase: "rest",
        overview: false,
        draft: { setId: "set-1", values: { weight: "27.", reps: "" } },
      },
      deferredInputs: { "set-2": { weight: "30", reps: "12" } },
    },
    body: [],
    equipment: [],
    custom: [],
    favourites: [],
    exerciseNotes: {},
    setupNotes: {},
    settings: { weight: "kg", length: "cm", distance: "km", effort: "off" },
    timer: finishedAt + 45000,
  };
}

test("accidental finish survives backup reload and restores cursor, drafts, rest and plan without duplicate history", () => {
  const state = session();
  const before = structuredClone(state.active);
  assert.equal(finishWorkoutState(state, finishedAt), true);
  assert.equal(state.active, null);
  assert.equal(state.plans[0].next, 1);
  assert.equal(state.workouts.length, 1);
  assert.equal(state.workouts[0].guided, undefined);
  assert.equal(state.workouts[0].deferredInputs, undefined);
  const reloaded = validateBackup(JSON.parse(JSON.stringify(state)));
  assert.equal(
    reopenWorkout(reloaded, "workout", finishedAt + 600000),
    "reopened",
  );
  assert.deepEqual(reloaded.active, before);
  assert.equal(reloaded.timer, finishedAt + 645000);
  assert.equal(reloaded.plans[0].next, 0);
  assert.equal(reloaded.workouts.length, 0);
  assert.equal(reloaded.completionUndo, undefined);
  assert.equal(reopenWorkout(reloaded, "workout"), "active-exists");
  assert.doesNotThrow(() => validateBackup(reloaded));
});

test("reopening does not replace the current workout or remove either session", () => {
  const state = session();
  finishWorkoutState(state, finishedAt);
  state.active = {
    ...structuredClone(state.completionUndo.workout),
    id: "other-workout",
  };
  const before = structuredClone(state);
  assert.equal(reopenWorkout(state, "workout"), "active-exists");
  assert.deepEqual(state, before);
});

test("reopening a legacy history session selects its first unfinished set and keeps all completed results", () => {
  const state = session();
  finishWorkoutState(state, finishedAt);
  delete state.completionUndo;
  assert.equal(reopenWorkout(state, "workout"), "reopened");
  assert.equal(currentStep(state.active).set.id, "set-1");
  assert.equal(state.active.movements[0].sets[0].done, true);
  assert.equal(state.active.guided.phase, "entry");
  assert.equal(state.plans[0].next, 1);
});

test("reopening an all-complete session shows summary without clearing its last result", () => {
  const state = session();
  state.active.movements[0].sets.forEach((set) => {
    set.done = true;
  });
  state.active.guided = { phase: "summary", overview: false };
  state.timer = null;
  finishWorkoutState(state, finishedAt);
  delete state.completionUndo;
  reopenWorkout(state, "workout", finishedAt + 1000);
  assert.equal(state.active.guided.phase, "summary");
  assert.equal(
    state.active.movements[0].sets.filter((set) => set.done).length,
    3,
  );
  assert.equal(currentStep(state.active), undefined);
});

test("paused finish recovery remains paused and rebases its pause time", () => {
  const state = session();
  state.active.pausedAt = finishedAt - 10000;
  state.active.pausedRestMs = 45000;
  state.timer = null;
  finishWorkoutState(state, finishedAt);
  reopenWorkout(state, "workout", finishedAt + 600000);
  assert.equal(state.active.pausedAt, finishedAt + 600000);
  assert.equal(state.active.pausedRestMs, 45000);
  assert.equal(state.timer, null);
});

test("reopen rolls back the plan pointer only when the advanced plan remains unchanged", () => {
  for (const alter of [
    (s) => {
      s.plans[0].next = 0;
    },
    (s) => {
      s.plans[0].name = "Updated plan";
    },
    (s) => {
      s.plans[0].days.reverse();
    },
    (s) => {
      s.plans[0].days[0].movements[0].rest = 120;
    },
  ]) {
    const state = session();
    finishWorkoutState(state, finishedAt);
    alter(state);
    const plan = structuredClone(state.plans[0]);
    reopenWorkout(state, "workout", finishedAt + 1000);
    assert.deepEqual(state.plans[0], plan);
  }
});

test("reopening a session does not roll back a plan with a later completed workout", () => {
  const state = session();
  finishWorkoutState(state, finishedAt);
  state.workouts.push({
    ...structuredClone(state.workouts[0]),
    id: "later-workout",
    started: "2026-10-09T10:00:00Z",
    finished: "2026-10-09T11:00:00Z",
  });
  reopenWorkout(state, "workout", finishedAt + 1000);
  assert.equal(state.plans[0].next, 1);
  assert.deepEqual(
    state.workouts.map((w) => w.id),
    ["later-workout"],
  );
});

test("history corrections supersede old draft text and older undo snapshots", () => {
  const state = session();
  recordWorkoutAction(state, "Add set", finishedAt - 1000);
  finishWorkoutState(state, finishedAt);
  state.workouts[0].movements[0].sets[1].weight = 35;
  state.workouts[0].movements[0].sets[0].reps = 12;
  reopenWorkout(state, "workout", finishedAt + 1000);
  assert.equal(state.active.movements[0].sets[1].weight, 35);
  assert.deepEqual(state.active.guided.draft.values, { reps: "" });
  assert.equal(state.active.undoActions, undefined);
  assert.equal(state.active.movements[0].sets[0].reps, 12);
});

test("finishing and reopening preserve generic workout undo actions across reload", () => {
  const state = session();
  recordWorkoutAction(state, "Add set", finishedAt - 1000);
  state.active.movements[0].sets.push({
    ...state.active.movements[0].sets[2],
    id: "extra-set",
  });
  finishWorkoutState(state, finishedAt);
  const reloaded = validateBackup(JSON.parse(JSON.stringify(state)));
  reopenWorkout(reloaded, "workout", finishedAt + 1000);
  assert.equal(reloaded.active.undoActions[0].label, "Add set");
  assert.equal(undoWorkoutAction(reloaded, finishedAt + 2000), true);
  assert.equal(reloaded.active.movements[0].sets.length, 3);
});

test("finish and reopen can repeat without inflating completed session counts", () => {
  const state = session();
  for (let index = 0; index < 3; index++) {
    assert.equal(finishWorkoutState(state, finishedAt + index * 2000), true);
    assert.equal(finishWorkoutState(state, finishedAt + index * 2000), false);
    assert.equal(state.workouts.length, 1);
    assert.equal(
      reopenWorkout(state, "workout", finishedAt + index * 2000 + 1000),
      "reopened",
    );
    assert.equal(state.workouts.length, 0);
  }
});

test("invalid finish, stale reopen and deleted plan do not damage the journal", () => {
  const state = session();
  const unchanged = structuredClone(state);
  assert.equal(
    reopenWorkout({ ...state, active: null }, "missing"),
    "not-found",
  );
  state.active.movements[0].sets[0].done = false;
  assert.equal(finishWorkoutState(state, finishedAt), false);
  state.active = structuredClone(unchanged.active);
  state.active.guided.editing = { setId: "set-0" };
  assert.equal(finishWorkoutState(state, finishedAt), false);
  delete state.active.guided.editing;
  finishWorkoutState(state, finishedAt);
  state.plans = [];
  assert.equal(reopenWorkout(state, "workout", finishedAt + 1000), "reopened");
});

test("discard recovery survives reload and restores unfinished draft, completed results and remaining rest", () => {
  const state = session();
  const original = structuredClone(state.active);
  assert.equal(removeWorkout(state, "workout", finishedAt), true);
  assert.equal(state.active, null);
  assert.equal(state.timer, null);
  assert.equal(state.plans[0].next, 0);
  const reloaded = validateBackup(JSON.parse(JSON.stringify(state)));
  assert.equal(
    restoreRemovedWorkout(reloaded, finishedAt + 600000),
    "restored",
  );
  assert.deepEqual(reloaded.active, original);
  assert.equal(reloaded.timer, finishedAt + 645000);
  assert.equal(reloaded.workoutRemovalUndo, undefined);
  assert.equal(reloaded.workouts.length, 0);
});

test("discard recovery keeps both sessions untouched when another workout is active", () => {
  const state = session();
  const other = { ...structuredClone(state.active), id: "other" };
  removeWorkout(state, "workout", finishedAt);
  state.active = other;
  const before = structuredClone(state);
  assert.equal(
    restoreRemovedWorkout(state, finishedAt + 1000),
    "active-exists",
  );
  assert.deepEqual(state, before);
});

test("discard recovery preserves a paused workout without restarting its countdown", () => {
  const state = session();
  state.active.pausedAt = finishedAt;
  state.active.pausedRestMs = 45000;
  state.timer = null;
  removeWorkout(state, "workout", finishedAt + 1000);
  const reloaded = validateBackup(JSON.parse(JSON.stringify(state)));
  restoreRemovedWorkout(reloaded, finishedAt + 600000);
  assert.equal(reloaded.active.pausedAt, finishedAt + 600000);
  assert.equal(reloaded.active.pausedRestMs, 45000);
  assert.equal(reloaded.timer, null);
});

test("history deletion can be undone beside another active workout without changing its timer or plan", () => {
  const state = session();
  const active = { ...structuredClone(state.active), id: "other" };
  finishWorkoutState(state, finishedAt);
  state.active = active;
  state.timer = finishedAt + 90000;
  assert.equal(removeWorkout(state, "workout", finishedAt + 1000), true);
  assert.equal(state.workouts.length, 0);
  const reloaded = validateBackup(JSON.parse(JSON.stringify(state)));
  assert.equal(restoreRemovedWorkout(reloaded, finishedAt + 2000), "restored");
  assert.deepEqual(reloaded.active, active);
  assert.equal(reloaded.timer, finishedAt + 90000);
  assert.equal(reloaded.plans[0].next, 1);
  assert.equal(reloaded.workouts.length, 1);
  assert.equal(restoreRemovedWorkout(reloaded), "not-found");
  assert.equal(reloaded.workouts.length, 1);
});

test("undo delete keeps the earlier accidental finish recovery available", () => {
  const state = session();
  finishWorkoutState(state, finishedAt);
  removeWorkout(state, "workout", finishedAt + 1000);
  const reloaded = validateBackup(JSON.parse(JSON.stringify(state)));
  restoreRemovedWorkout(reloaded, finishedAt + 2000);
  assert.equal(reloaded.completionUndo.workoutId, "workout");
  assert.equal(
    reopenWorkout(reloaded, "workout", finishedAt + 3000),
    "reopened",
  );
  assert.equal(reloaded.active.guided.phase, "rest");
  assert.equal(reloaded.plans[0].next, 0);
});

test("removal recovery refuses an existing matching session without duplicating or clearing the saved recovery", () => {
  const state = session();
  finishWorkoutState(state, finishedAt);
  removeWorkout(state, "workout", finishedAt + 1000);
  state.workouts.push(structuredClone(state.workoutRemovalUndo.workout));
  const before = structuredClone(state);
  assert.equal(restoreRemovedWorkout(state, finishedAt + 2000), "duplicate");
  assert.deepEqual(state, before);
});

test("only the most recent discarded or deleted workout occupies the recovery slot", () => {
  const state = session();
  const other = { ...structuredClone(state.active), id: "other" };
  removeWorkout(state, "workout", finishedAt);
  state.active = other;
  removeWorkout(state, "other", finishedAt + 1000);
  assert.equal(state.workoutRemovalUndo.workout.id, "other");
  const before = structuredClone(state);
  assert.equal(removeWorkout(state, "missing", finishedAt + 2000), false);
  assert.deepEqual(state, before);
});
