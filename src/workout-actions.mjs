/** Supersets alternate by round only when circuit order is selected. */
/** @param {import('./types').Movement[]} movements @param {'exercise'|'circuit'} [setOrder] */
export function workoutQueue(movements, setOrder = "exercise") {
  const seen = new Set();
  /** @type {{movement: import('./types').Movement, set: import('./types').SetLog, index: number}[]} */
  const queue = [];
  for (const movement of movements) {
    if (seen.has(movement.id)) continue;
    const group =
      movement.superset && setOrder === "circuit"
        ? movements.filter((m) => m.superset === movement.superset)
        : [movement];
    group.forEach((m) => seen.add(m.id));
    for (
      let index = 0;
      index < Math.max(0, ...group.map((m) => m.sets.length));
      index++
    ) {
      for (const m of group) {
        if (m.sets[index])
          queue.push({ movement: m, set: m.sets[index], index });
      }
    }
  }
  return queue;
}

/** @param {import('./types').Workout} workout */
export function currentStep(workout) {
  const queue = workoutQueue(workout.movements, workout.setOrder ?? "exercise");
  const editingId = workout.guided?.editing?.setId;
  return (
    queue.find((step) =>
      editingId
        ? step.set.id === editingId
        : step.set.id === workout.guided?.setId &&
          !step.set.done &&
          !step.set.skipped,
    ) ?? queue.find((step) => !step.set.done && !step.set.skipped)
  );
}

/** Continue the selected exercise, then wrap around to unfinished work left earlier. */
/** @param {import('./types').Workout} workout @param {string} currentSetId */
export function nextStep(workout, currentSetId) {
  const queue = workoutQueue(workout.movements, workout.setOrder ?? "exercise");
  const index = queue.findIndex((step) => step.set.id === currentSetId);
  const rotated =
    index < 0 ? queue : [...queue.slice(index + 1), ...queue.slice(0, index)];
  const unfinished = rotated.filter(
    (step) => !step.set.done && !step.set.skipped,
  );
  if (workout.setOrder !== "circuit" && index >= 0) {
    const sameExercise = unfinished.find(
      (step) => step.movement.id === queue[index].movement.id,
    );
    if (sameExercise) return sameExercise;
  }
  return unfinished[0];
}

/** Preserve unfinished text such as an empty field when moving elsewhere. */
/** @param {import('./types').Workout} workout */
export function preserveGuidedDraft(workout) {
  const draft = workout.guided?.draft;
  if (!draft) return;
  if (!workout.movements.some((m) => m.sets.some((s) => s.id === draft.setId)))
    return;
  workout.deferredInputs ??= {};
  workout.deferredInputs[draft.setId] = structuredClone(draft.values);
}

/** Remove transient references after an exercise or set was removed/replaced. */
/** @param {import('./types').Workout} workout */
export function cleanWorkoutProgress(workout) {
  const sets = new Map(
    workout.movements.flatMap((m) => m.sets.map((set) => [set.id, set])),
  );
  for (const setId of Object.keys(workout.deferredInputs ?? {})) {
    if (!sets.has(setId)) delete workout.deferredInputs[setId];
  }
  const guided = workout.guided;
  if (!guided) return;
  if (guided.draft && !sets.has(guided.draft.setId)) delete guided.draft;
  if (guided.editing && !sets.get(guided.editing.setId)?.done)
    delete guided.editing;
  if (guided.undo && !sets.has(guided.undo.setId)) delete guided.undo;
  for (const snapshot of [guided.editing, guided.undo]) {
    if (
      snapshot?.returnGuided.draft &&
      !sets.has(snapshot.returnGuided.draft.setId)
    )
      delete snapshot.returnGuided.draft;
  }
}

/** Overview edits should replace raw text only for the numerical fields actually changed. */
/** @param {import('./types').Workout} workout @param {import('./types').Movement[]} before */
export function syncEditedInputs(workout, before) {
  const previous = new Map(
    before.flatMap((m) => m.sets.map((set) => [set.id, set])),
  );
  for (const set of workout.movements.flatMap((m) => m.sets)) {
    const original = previous.get(set.id);
    if (!original) continue;
    if (original.done !== set.done && workout.guided)
      delete workout.guided.undo;
    /** @type {('weight'|'reps'|'seconds'|'distance'|'effort')[]} */
    const keys = ["weight", "reps", "seconds", "distance", "effort"];
    for (const key of keys) {
      if (
        original[key] === set[key] &&
        !(key === "weight" && original.needsLoad !== set.needsLoad)
      )
        continue;
      if (workout.guided?.draft?.setId === set.id)
        delete workout.guided.draft.values[key];
      if (workout.deferredInputs?.[set.id])
        delete workout.deferredInputs[set.id][key];
    }
    if (
      workout.deferredInputs?.[set.id] &&
      !Object.keys(workout.deferredInputs[set.id]).length
    )
      delete workout.deferredInputs[set.id];
  }
  if (workout.guided?.draft && !Object.keys(workout.guided.draft.values).length)
    delete workout.guided.draft;
}

/** @param {import('./types').Workout} workout */
function guidedPosition(workout) {
  const guided = workout.guided;
  /** @type {import('./types').GuidedPosition} */
  const position = { phase: guided?.phase ?? "intro" };
  if (guided?.setId !== undefined) position.setId = guided.setId;
  if (guided?.lastSetId !== undefined) position.lastSetId = guided.lastSetId;
  if (guided?.overview !== undefined) position.overview = guided.overview;
  if (guided?.draft !== undefined)
    position.draft = structuredClone(guided.draft);
  return position;
}

/** @param {import('./types').State} state @param {string} setId @param {number} now */
function setReturn(state, setId, now) {
  const active = state.active;
  const target = active?.movements
    .flatMap((m) => m.sets)
    .find((s) => s.id === setId);
  if (!active || !target) return undefined;
  return {
    setId,
    original: structuredClone(target),
    returnGuided: guidedPosition(active),
    remainingRestMs:
      state.timer === null ? null : Math.max(0, state.timer - now),
    ...(active.deferredInputs?.[setId]
      ? { deferredValues: structuredClone(active.deferredInputs[setId]) }
      : {}),
  };
}

/** @param {import('./types').State} state @param {import('./types').GuidedSetReturn} snapshot @param {number} now @param {boolean} restoreSet */
function restorePosition(state, snapshot, now, restoreSet) {
  const active = state.active;
  const movement = active?.movements.find((m) =>
    m.sets.some((s) => s.id === snapshot.setId),
  );
  if (!active || !movement) return false;
  if (restoreSet) {
    const index = movement.sets.findIndex((s) => s.id === snapshot.setId);
    movement.sets[index] = structuredClone(snapshot.original);
    if (snapshot.deferredValues) {
      active.deferredInputs ??= {};
      active.deferredInputs[snapshot.setId] = structuredClone(
        snapshot.deferredValues,
      );
    } else if (active.deferredInputs)
      delete active.deferredInputs[snapshot.setId];
  }
  const undo = active.guided?.undo;
  active.guided = {
    ...structuredClone(snapshot.returnGuided),
    ...(undo ? { undo } : {}),
  };
  state.timer =
    snapshot.remainingRestMs === null ? null : now + snapshot.remainingRestMs;
  return true;
}

/** Select an unfinished set, or bring back one skipped set, without losing a draft. */
/** @param {import('./types').State} state @param {string} setId */
export function guideSet(state, setId) {
  const active = state.active;
  const target = active?.movements
    .flatMap((m) => m.sets)
    .find((s) => s.id === setId);
  if (
    !active ||
    active.pausedAt !== undefined ||
    active.guided?.editing ||
    !target ||
    target.done
  )
    return false;
  preserveGuidedDraft(active);
  target.skipped = false;
  active.guided = {
    setId,
    phase: "entry",
    overview: false,
    ...(active.guided?.undo ? { undo: active.guided.undo } : {}),
  };
  state.timer = null;
  return true;
}

/** Keep the completed result counted while opening a reversible correction. */
/** @param {import('./types').State} state @param {string} setId @param {number} [now] */
export function beginCorrection(state, setId, now = Date.now()) {
  const active = state.active;
  const snapshot = setReturn(state, setId, now);
  if (
    !active ||
    active.pausedAt !== undefined ||
    active.guided?.editing ||
    !snapshot?.original.done
  )
    return false;
  preserveGuidedDraft(active);
  // A completed result is the source for correction, even if older raw text remains.
  if (active.deferredInputs) delete active.deferredInputs[setId];
  active.guided = {
    setId,
    phase: "entry",
    overview: false,
    editing: snapshot,
    ...(active.guided?.undo ? { undo: active.guided.undo } : {}),
  };
  state.timer = null;
  return true;
}

/** Saving a correction restores the prior position without completing another set. */
/** @param {import('./types').State} state @param {number} [now] */
export function saveCorrection(state, now = Date.now()) {
  const active = state.active;
  const editing = active?.guided?.editing;
  const target = active?.movements
    .flatMap((m) => m.sets)
    .find((s) => s.id === editing?.setId);
  if (
    !active ||
    active.pausedAt !== undefined ||
    !editing ||
    !target ||
    target.needsLoad ||
    active.guided?.draft?.values.weight === ""
  )
    return false;
  target.done = true;
  target.skipped = false;
  if (active.deferredInputs) delete active.deferredInputs[editing.setId];
  // A correction to the action being undone supersedes that older result.
  if (active.guided?.undo?.setId === editing.setId) delete active.guided.undo;
  return restorePosition(state, editing, now, false);
}

/** @param {import('./types').State} state @param {number} [now] */
export function cancelCorrection(state, now = Date.now()) {
  const editing = state.active?.guided?.editing;
  if (!editing || state.active?.pausedAt !== undefined) return false;
  return restorePosition(state, editing, now, true);
}

/** Freeze the rest countdown and leave every result and draft in place. */
/** @param {import('./types').State} state @param {number} [now] */
export function pauseWorkout(state, now = Date.now()) {
  const active = state.active;
  if (!active || active.pausedAt !== undefined) return false;
  active.pausedAt = now;
  if (state.timer !== null)
    active.pausedRestMs = Math.max(0, state.timer - now);
  else delete active.pausedRestMs;
  state.timer = null;
  return true;
}

/** @param {import('./types').State} state @param {number} [now] */
export function resumeWorkout(state, now = Date.now()) {
  const active = state.active;
  if (!active || active.pausedAt === undefined) return false;
  state.timer =
    active.pausedRestMs === undefined ? null : now + active.pausedRestMs;
  delete active.pausedAt;
  delete active.pausedRestMs;
  return true;
}

/** Call before marking a set complete; retain guided.undo in the new guided position. */
/** @param {import('./types').State} state @param {string} setId @param {'complete'|'skip'} [kind] @param {number} [now] */
export function rememberSetUndo(
  state,
  setId,
  kind = "complete",
  now = Date.now(),
) {
  const active = state.active;
  const snapshot = setReturn(state, setId, now);
  if (
    !active ||
    active.pausedAt !== undefined ||
    active.guided?.editing ||
    !snapshot ||
    snapshot.original.done ||
    snapshot.original.skipped
  )
    return false;
  active.guided = {
    ...active.guided,
    phase: active.guided?.phase ?? "entry",
    undo: { ...snapshot, kind },
  };
  return true;
}

/** Skip only this set; the remaining sets in the exercise stay available. */
/** @param {import('./types').State} state @param {number} [now] */
export function skipCurrentSet(state, now = Date.now()) {
  const active = state.active;
  const current = active && currentStep(active);
  if (
    !active ||
    !current ||
    !rememberSetUndo(state, current.set.id, "skip", now)
  )
    return false;
  preserveGuidedDraft(active);
  current.set.skipped = true;
  const next = nextStep(active, current.set.id);
  active.guided = {
    setId: next?.set.id,
    phase: next ? "entry" : "summary",
    undo: active.guided?.undo,
  };
  state.timer = null;
  return true;
}

/** Restore only the affected set, preserving unrelated edits and extra sets. */
/** @param {import('./types').State} state @param {number} [now] */
export function undoLastSet(state, now = Date.now()) {
  const active = state.active;
  const undo = active?.guided?.undo;
  if (
    !active ||
    active.pausedAt !== undefined ||
    active.guided?.editing ||
    !undo
  )
    return false;
  preserveGuidedDraft(active);
  const restored = restorePosition(state, undo, now, true);
  if (active.guided) delete active.guided.undo;
  return restored;
}
