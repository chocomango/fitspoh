import { displayLoad, storedLoad, toDisplayDistance } from "./domain.mjs";
import { preserveGuidedDraft } from "./workout-actions.mjs";

/** @param {import('./types').State} state */
export const activePlan = (state) =>
  state.plans.find(
    (p) => p.id === state.settings.activePlanId && p.days.length,
  ) ?? state.plans.find((p) => p.days.length);

// Physical increments are stored in kg; stack increments are unitless.
export function weightIncrement(state, exercise) {
  const saved = state.settings.weightIncrements?.[exercise.id];
  return saved === undefined
    ? exercise.loadKind === "stack"
      ? 1
      : state.settings.weight === "lb"
        ? 5
        : 2.5
    : displayLoad(saved, state.settings.weight, exercise);
}
export function saveIncrement(state, exercise, value) {
  state.settings.weightIncrements ??= {};
  state.settings.weightIncrements[exercise.id] = storedLoad(
    value,
    state.settings.weight,
    exercise,
  );
}
export function switchWeightUnit(state, unit, lookup) {
  state.settings.weight = unit;
  convertWorkoutInputs(state, "weight", (value, exerciseId) =>
    displayLoad(value, unit, lookup(exerciseId)),
  );
}

export function switchDistanceUnit(state, unit) {
  state.settings.distance = unit;
  convertWorkoutInputs(state, "distance", (value) =>
    toDisplayDistance(value, unit),
  );
}

function convertWorkoutInputs(state, key, display) {
  function convertInputs(workout, actionSet) {
    const entries = Object.entries(workout.deferredInputs ?? {});
    if (workout.guided?.draft)
      entries.push([workout.guided.draft.setId, workout.guided.draft.values]);
    for (const snapshot of [
      workout.guided?.editing,
      workout.guided?.undo,
      actionSet,
    ]) {
      if (!snapshot) continue;
      if (snapshot.returnGuided.draft) {
        const draft = snapshot.returnGuided.draft;
        entries.push([
          draft.setId,
          draft.values,
          draft.setId === snapshot.setId ? snapshot.original[key] : undefined,
        ]);
      }
      if (snapshot.deferredValues)
        entries.push([
          snapshot.setId,
          snapshot.deferredValues,
          snapshot.original[key],
        ]);
    }
    for (const [setId, values, originalValue] of entries) {
      if (values[key] === undefined || values[key] === "") continue;
      const movement = workout.movements.find((m) =>
        m.sets.some((t) => t.id === setId),
      );
      const set = movement?.sets.find((t) => t.id === setId);
      if (set)
        values[key] = String(
          Number(
            display(originalValue ?? set[key], movement.exerciseId).toFixed(2),
          ),
        );
    }
  }
  for (const workout of [
    state.active,
    state.completionUndo?.workout,
    state.workoutRemovalUndo?.workout,
  ]) {
    if (!workout) continue;
    convertInputs(workout);
    for (const action of workout.undoActions ?? [])
      convertInputs(action.snapshot, action.set);
  }
}
export function postpone(workout, movementId) {
  if (workout.pausedAt !== undefined || workout.guided?.editing) return false;
  const current = workout.movements.find((m) => m.id === movementId);
  if (!current) return false;
  const group = workout.movements.filter(
    (m) =>
      m.id === movementId ||
      (workout.setOrder === "circuit" &&
        current.superset &&
        m.superset === current.superset),
  );
  const other = workout.movements.filter((m) => !group.includes(m));
  const next = other.flatMap((m) => m.sets).find((s) => !s.done && !s.skipped);
  if (!next) return false;
  preserveGuidedDraft(workout);
  const undo = workout.guided?.undo;
  workout.movements = [...other, ...group];
  workout.guided = {
    setId: next.id,
    phase: "intro",
    ...(undo ? { undo } : {}),
  };
  return true;
}
