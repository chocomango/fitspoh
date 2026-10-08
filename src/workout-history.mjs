import {
  currentStep,
  cleanWorkoutProgress,
  syncEditedInputs,
} from "./workout-actions.mjs";

/** Archive once, keeping a durable snapshot for an accidental finish. */
/** @param {import('./types').State} state @param {number} [now] */
export function finishWorkoutState(state, now = Date.now()) {
  const active = state.active;
  if (
    !active ||
    active.guided?.editing ||
    !active.movements.some((m) => m.sets.some((s) => s.done)) ||
    state.workouts.some((w) => w.id === active.id)
  )
    return false;
  /** @type {NonNullable<import('./types').State['completionUndo']>} */
  const recovery = {
    workoutId: active.id,
    workout: structuredClone(active),
    remainingRestMs:
      state.timer === null ? null : Math.max(0, state.timer - now),
  };
  const archived = structuredClone(active);
  archived.finished = new Date(now).toISOString();
  for (const key of [
    "guided",
    "deferredInputs",
    "pausedAt",
    "pausedRestMs",
    "undoActions",
  ])
    delete archived[key];
  const plan = state.plans.find((p) => p.id === archived.planId);
  if (plan) {
    const index = plan.days.findIndex((d) => d.id === archived.dayId);
    if (index >= 0) {
      const nextBefore = plan.next;
      plan.next = (index + 1) % plan.days.length;
      recovery.plan = { nextBefore, after: structuredClone(plan) };
    }
  }
  state.completionUndo = recovery;
  state.workouts.push(archived);
  state.active = null;
  state.timer = null;
  return true;
}

/** Resume a session without replacing another active workout or changing saved results. */
/** @param {import('./types').State} state @param {string} workoutId @param {number} [now] */
export function reopenWorkout(state, workoutId, now = Date.now()) {
  if (state.active) return "active-exists";
  const archived = state.workouts.find((w) => w.id === workoutId);
  if (!archived) return "not-found";
  const reopened = structuredClone(archived);
  delete reopened.finished;
  const recovery =
    state.completionUndo?.workoutId === workoutId
      ? state.completionUndo
      : undefined;
  state.timer = null;
  if (recovery) {
    // History corrections remain authoritative; restore only session controls and drafts.
    for (const key of [
      "guided",
      "deferredInputs",
      "pausedAt",
      "pausedRestMs",
      "undoActions",
    ]) {
      delete reopened[key];
      if (recovery.workout[key] !== undefined)
        reopened[key] = structuredClone(recovery.workout[key]);
    }
    syncEditedInputs(reopened, recovery.workout.movements);
    cleanWorkoutProgress(reopened);
    if (
      JSON.stringify(reopened.movements) !==
      JSON.stringify(recovery.workout.movements)
    ) {
      // A later history correction must not be overwritten by an older action snapshot.
      delete reopened.undoActions;
      if (reopened.guided) delete reopened.guided.undo;
    }
    if (reopened.pausedAt !== undefined) reopened.pausedAt = now;
    else if (recovery.remainingRestMs !== null)
      state.timer = now + recovery.remainingRestMs;
    const progress = recovery.plan;
    const plan = state.plans.find((p) => p.id === progress?.after.id);
    const laterPlanWorkout = state.workouts.some(
      (w) =>
        w.id !== workoutId &&
        w.planId === archived.planId &&
        w.finished &&
        archived.finished &&
        w.finished >= archived.finished,
    );
    if (
      plan &&
      progress &&
      !laterPlanWorkout &&
      JSON.stringify(plan) === JSON.stringify(progress.after)
    )
      plan.next = progress.nextBefore;
    delete state.completionUndo;
  } else {
    delete reopened.pausedAt;
    delete reopened.pausedRestMs;
    delete reopened.undoActions;
    delete reopened.deferredInputs;
    const next = currentStep(reopened);
    reopened.guided = {
      setId: next?.set.id,
      phase: next ? "entry" : "summary",
      overview: false,
    };
  }
  const focusedSet = reopened.guided?.setId;
  if (
    focusedSet &&
    !reopened.movements.some((m) => m.sets.some((s) => s.id === focusedSet))
  ) {
    const next = currentStep(reopened);
    reopened.guided = {
      setId: next?.set.id,
      phase: next ? "entry" : "summary",
      overview: false,
    };
    state.timer = null;
  }
  state.workouts = state.workouts.filter((w) => w.id !== workoutId);
  state.active = reopened;
  return "reopened";
}

/** Keep one removed session available for recovery after navigation or reload. */
/** @param {import('./types').State} state @param {string} workoutId @param {number} [now] */
export function removeWorkout(state, workoutId, now = Date.now()) {
  const wasActive = state.active?.id === workoutId;
  const workout = wasActive
    ? state.active
    : state.workouts.find((w) => w.id === workoutId);
  if (!workout) return false;
  state.workoutRemovalUndo = {
    workout: structuredClone(workout),
    wasActive,
    remainingRestMs:
      wasActive && state.timer !== null && workout.pausedAt === undefined
        ? Math.max(0, state.timer - now)
        : null,
  };
  if (wasActive) {
    state.active = null;
    state.timer = null;
  } else state.workouts = state.workouts.filter((w) => w.id !== workoutId);
  return true;
}

/** Restore a discarded session or deleted history entry without replacing another one. */
/** @param {import('./types').State} state @param {number} [now] */
export function restoreRemovedWorkout(state, now = Date.now()) {
  const recovery = state.workoutRemovalUndo;
  if (!recovery) return "not-found";
  if (recovery.wasActive && state.active) return "active-exists";
  if (
    state.active?.id === recovery.workout.id ||
    state.workouts.some((w) => w.id === recovery.workout.id)
  )
    return "duplicate";
  const workout = structuredClone(recovery.workout);
  if (recovery.wasActive) {
    state.active = workout;
    if (workout.pausedAt !== undefined) workout.pausedAt = now;
    state.timer =
      workout.pausedAt !== undefined || recovery.remainingRestMs === null
        ? null
        : now + recovery.remainingRestMs;
  } else state.workouts.push(workout);
  delete state.workoutRemovalUndo;
  return "restored";
}
