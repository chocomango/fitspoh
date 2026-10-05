/** Shared completion validation; zero added load is valid when explicitly chosen. */
export function setIssue(set, exercise) {
  if (set.needsLoad)
    return "Choose a load for this set, or explicitly enter 0 for no added load.";
  if (
    exercise?.mode === "strength" &&
    (!Number.isInteger(set.reps) || set.reps < 1)
  )
    return "Enter a whole number of reps greater than zero.";
  if (
    exercise?.mode !== "strength" &&
    (!Number.isFinite(set.seconds) || set.seconds <= 0)
  )
    return "Enter a duration greater than zero.";
  return "";
}

export function sessionComparisons(workout, history) {
  const rows = [];
  for (const movement of workout.movements) {
    const current = movement.sets.filter(
      (s) => s.done && s.type === "working" && s.reps > 0,
    );
    const previous = [...history]
      .filter((w) => w.finished)
      .sort((a, b) => b.started.localeCompare(a.started))
      .find((w) =>
        w.movements.some(
          (m) =>
            m.exerciseId === movement.exerciseId &&
            m.sets.some((s) => s.done && s.type === "working"),
        ),
      );
    const prior =
      previous?.movements
        .filter((m) => m.exerciseId === movement.exerciseId)
        .flatMap((m) => m.sets)
        .filter((s) => s.done && s.type === "working" && s.reps > 0) ?? [];
    for (const weight of [...new Set(current.map((s) => s.weight))]) {
      const sets = current.filter((s) => s.weight === weight);
      const old = prior.filter((s) => Math.abs(s.weight - weight) < 1e-6);
      rows.push({
        movementId: movement.id,
        exerciseId: movement.exerciseId,
        weight,
        reps: sets.reduce((n, s) => n + s.reps, 0),
        sets: sets.length,
        previousReps: old.length
          ? old.reduce((n, s) => n + s.reps, 0)
          : undefined,
        previousSets: old.length,
      });
    }
  }
  return rows;
}
