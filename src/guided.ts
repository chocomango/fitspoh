import type { Movement, Workout } from "./types";
/** Supersets are traversed by round, ordinary exercises by set. */
export function workoutQueue(
  movements: Movement[],
  setOrder: "exercise" | "circuit" = "circuit",
) {
  const seen = new Set<string>();
  const queue: {
    movement: Movement;
    set: Movement["sets"][number];
    index: number;
  }[] = [];
  for (const m of movements) {
    if (seen.has(m.id)) continue;
    const group =
      m.superset && setOrder === "circuit"
        ? movements.filter((x) => x.superset === m.superset)
        : [m];
    group.forEach((x) => seen.add(x.id));
    for (let i = 0; i < Math.max(0, ...group.map((x) => x.sets.length)); i++) {
      for (const movement of group) {
        if (movement.sets[i])
          queue.push({ movement, set: movement.sets[i], index: i });
      }
    }
  }
  return queue;
}
export function currentStep(w: Workout) {
  const queue = workoutQueue(w.movements, w.setOrder ?? "exercise");
  return (
    queue.find(
      (x) => x.set.id === w.guided?.setId && !x.set.done && !x.set.skipped,
    ) ?? queue.find((x) => !x.set.done && !x.set.skipped)
  );
}
