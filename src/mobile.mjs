import { displayLoad, storedLoad } from "./domain.mjs";

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
  const workout = state.active;
  if (!workout) return;
  const entries = Object.entries(workout.deferredInputs ?? {});
  if (workout.guided?.draft)
    entries.push([workout.guided.draft.setId, workout.guided.draft.values]);
  for (const [setId, values] of entries) {
    if (values.weight === undefined || values.weight === "") continue;
    const movement = workout.movements.find((m) =>
      m.sets.some((t) => t.id === setId),
    );
    const set = movement?.sets.find((t) => t.id === setId);
    if (set)
      values.weight = String(
        Number(
          displayLoad(set.weight, unit, lookup(movement.exerciseId)).toFixed(2),
        ),
      );
  }
}
export function postpone(workout, movementId) {
  const current = workout.movements.find((m) => m.id === movementId);
  if (!current) return false;
  const group = workout.movements.filter(
    (m) =>
      m.id === movementId ||
      (current.superset && m.superset === current.superset),
  );
  const other = workout.movements.filter((m) => !group.includes(m));
  const next = other.flatMap((m) => m.sets).find((s) => !s.done && !s.skipped);
  if (!next) return false;
  const draft = workout.guided?.draft;
  if (draft) {
    workout.deferredInputs ??= {};
    workout.deferredInputs[draft.setId] = draft.values;
  }
  workout.movements = [...other, ...group];
  workout.guided = { setId: next.id, phase: "intro" };
  return true;
}
