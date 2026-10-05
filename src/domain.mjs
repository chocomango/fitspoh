export const uid = () => globalThis.crypto.randomUUID();
export function csvCell(value) {
  const text = String(value ?? "");
  const safe =
    typeof value === "string" && /^\s*[=+@-]/.test(text) ? "'" + text : text;
  return '"' + safe.replaceAll('"', '""') + '"';
}
export const toDisplayWeight = (n, unit) =>
  unit === "lb" ? n * 2.2046226218 : n;
export const toStoredWeight = (n, unit) =>
  unit === "lb" ? n / 2.2046226218 : n;
export const displayLoad = (n, unit, exercise) =>
  exercise?.loadKind === "stack" ? n : toDisplayWeight(n, unit);
export const storedLoad = (n, unit, exercise) =>
  exercise?.loadKind === "stack" ? n : toStoredWeight(n, unit);
export const loadUnit = (unit, exercise) =>
  exercise?.loadKind === "stack"
    ? "stack setting"
    : `${unit}${exercise?.loadKind === "per-side" ? " per side" : exercise?.loadKind === "plates" ? " plates" : ""}`;
export const toDisplayLength = (n, unit) => (unit === "in" ? n / 2.54 : n);
export const toStoredLength = (n, unit) => (unit === "in" ? n * 2.54 : n);
export const toDisplayDistance = (n, unit) =>
  unit === "mi" ? n / 1.609344 : n;
export const toStoredDistance = (n, unit) => (unit === "mi" ? n * 1.609344 : n);
/** @param {any} workout @param {((id:string)=>{mode:string,name:string,loadKind?:string}|undefined)|null} [lookup] */
export const volume = (workout, lookup = null) =>
  workout.movements.reduce(
    (sum, m) =>
      sum +
      (lookup &&
      (lookup(m.exerciseId)?.mode !== "strength" ||
        lookup(m.exerciseId)?.loadKind ||
        /assisted/i.test(lookup(m.exerciseId)?.name ?? ""))
        ? 0
        : m.sets
            .filter((s) => s.done && s.type !== "warmup")
            .reduce((v, s) => v + s.weight * s.reps, 0)),
    0,
  );
export const available = (exercise, equipment) =>
  exercise.required.every(
    (id) =>
      id === "body only" ||
      equipment.some((e) => e.id === id && e.confirmed && !e.unavailable),
  );
export const rollingWeight = (entries) =>
  entries
    .filter((e) => Number.isFinite(e.weight))
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((e) => {
      const end = new Date(e.date).getTime();
      const samples = entries.filter(
        (x) =>
          Number.isFinite(x.weight) &&
          new Date(x.date).getTime() <= end &&
          new Date(x.date).getTime() > end - 7 * 86400000,
      );
      return {
        date: e.date,
        value: samples.reduce((sum, x) => sum + x.weight, 0) / samples.length,
      };
    });
const numeric = (n, max = 1e6) =>
  typeof n === "number" && Number.isFinite(n) && n >= 0 && n <= max;
const str = (x) => typeof x === "string";
const date = (x) => str(x) && Number.isFinite(Date.parse(x));
const id = (x) => str(x) && x.length > 0 && x.length < 200;
const strings = (x) => Array.isArray(x) && x.every(str);
const unique = (arr) => new Set(arr.map((x) => x.id)).size === arr.length;
const set = (s) =>
  s &&
  id(s.id) &&
  numeric(s.weight) &&
  numeric(s.reps, 10000) &&
  numeric(s.seconds, 604800) &&
  numeric(s.distance, 10000) &&
  ["working", "warmup", "drop", "failure"].includes(s.type) &&
  typeof s.done === "boolean" &&
  (s.skipped === undefined || typeof s.skipped === "boolean") &&
  (s.needsLoad === undefined || typeof s.needsLoad === "boolean") &&
  !(s.done && s.needsLoad) &&
  (s.effort === undefined || numeric(s.effort, 10)) &&
  (s.effortKind === undefined || ["RIR", "RPE"].includes(s.effortKind));
const movement = (m) =>
  m &&
  id(m.id) &&
  id(m.exerciseId) &&
  Array.isArray(m.sets) &&
  m.sets.every(set) &&
  unique(m.sets) &&
  numeric(m.rest, 3600) &&
  str(m.notes) &&
  (m.optional === undefined || typeof m.optional === "boolean") &&
  str(m.superset) &&
  numeric(m.repMin, 10000) &&
  numeric(m.repMax, 10000) &&
  m.repMax >= m.repMin;
const movements = (m) => Array.isArray(m) && m.every(movement) && unique(m);
const day = (d) =>
  d &&
  id(d.id) &&
  str(d.name) &&
  movements(d.movements) &&
  (d.notes === undefined || str(d.notes)) &&
  (d.restDay === undefined || typeof d.restDay === "boolean");
const buddyPreferences = (p) =>
  p &&
  ["suggest", "adapt", "create"].includes(p.mode) &&
  ["routine", "plan"].includes(p.output) &&
  ["beginner", "intermediate", "advanced"].includes(p.experience) &&
  ["full-body", "upper", "lower", "push", "pull", "legs"].includes(p.focus) &&
  [20, 40, 60].includes(p.minutes) &&
  [2, 3, 4, 5].includes(p.frequency) &&
  typeof p.avoidOverhead === "boolean" &&
  typeof p.avoidGrip === "boolean" &&
  Array.isArray(p.exclusions) &&
  p.exclusions.every(id) &&
  (p.equipmentIds === undefined ||
    (Array.isArray(p.equipmentIds) && p.equipmentIds.every(id))) &&
  ["exerciseId", "sourcePlanId", "sourceDayId", "sourceMovementId"].every(
    (key) => p[key] === undefined || id(p[key]),
  ) &&
  (p.muscle === undefined || str(p.muscle)) &&
  (p.sourceScope === undefined || ["plan", "active"].includes(p.sourceScope));
const buddyDraft = (d) =>
  d &&
  id(d.id) &&
  str(d.name) &&
  Array.isArray(d.days) &&
  d.days.every(day) &&
  unique(d.days) &&
  strings(d.changes) &&
  strings(d.warnings) &&
  d.reasons &&
  typeof d.reasons === "object" &&
  !Array.isArray(d.reasons) &&
  Object.values(d.reasons).every(str) &&
  Array.isArray(d.suggestions) &&
  d.suggestions.length <= 3 &&
  d.suggestions.every(
    (s) =>
      s && id(s.exerciseId) && str(s.reason) && typeof s.newToYou === "boolean",
  ) &&
  (d.source === undefined ||
    (d.source &&
      day(d.source.snapshot) &&
      ["planId", "dayId", "movementId", "workoutId"].every(
        (key) => d.source[key] === undefined || id(d.source[key]),
      )));
const inputValues = (values) =>
  values &&
  typeof values === "object" &&
  !Array.isArray(values) &&
  Object.entries(values).every(
    ([key, value]) =>
      ["weight", "reps", "seconds", "distance", "effort"].includes(key) &&
      str(value) &&
      value.length <= 40,
  );
const workout = (w) =>
  w &&
  id(w.id) &&
  str(w.name) &&
  date(w.started) &&
  (w.finished === undefined || date(w.finished)) &&
  movements(w.movements) &&
  str(w.notes) &&
  (w.planId === undefined || id(w.planId)) &&
  (w.dayId === undefined || id(w.dayId)) &&
  (w.deferredInputs === undefined ||
    (w.deferredInputs &&
      typeof w.deferredInputs === "object" &&
      !Array.isArray(w.deferredInputs) &&
      Object.entries(w.deferredInputs).every(
        ([key, values]) =>
          id(key) &&
          w.movements.some((m) => m.sets.some((s) => s.id === key)) &&
          inputValues(values),
      ))) &&
  (w.guided === undefined ||
    (w.guided &&
      ["intro", "entry", "rest", "between", "summary"].includes(
        w.guided.phase,
      ) &&
      (w.guided.setId === undefined || id(w.guided.setId)) &&
      (w.guided.lastSetId === undefined || id(w.guided.lastSetId)) &&
      (w.guided.overview === undefined ||
        typeof w.guided.overview === "boolean") &&
      (w.guided.draft === undefined ||
        (w.guided.draft &&
          id(w.guided.draft.setId) &&
          w.guided.draft.values &&
          typeof w.guided.draft.values === "object" &&
          !Array.isArray(w.guided.draft.values) &&
          Object.entries(w.guided.draft.values).every(
            ([key, value]) =>
              ["weight", "reps", "seconds", "distance", "effort"].includes(
                key,
              ) &&
              str(value) &&
              value.length <= 40,
          )))));
export function validateBackup(input, exerciseIds = []) {
  const s = input?.data ?? input;
  if (input?.format && input.format !== "fitspoh-backup")
    throw Error("This is not a Fitspoh backup.");
  if (!s || s.version !== 1) throw Error("Unsupported backup version.");
  for (const key of [
    "plans",
    "workouts",
    "body",
    "equipment",
    "custom",
    "favourites",
  ])
    if (!Array.isArray(s[key])) throw Error(`Missing ${key} data.`);
  if (
    !s.plans.every(
      (p) =>
        p &&
        id(p.id) &&
        str(p.name) &&
        (p.notes === undefined || str(p.notes)) &&
        (p.templateId === undefined || id(p.templateId)) &&
        Number.isInteger(p.next) &&
        p.next >= 0 &&
        Array.isArray(p.days) &&
        p.days.every(
          (d) =>
            d &&
            id(d.id) &&
            str(d.name) &&
            movements(d.movements) &&
            (d.notes === undefined || str(d.notes)) &&
            (d.restDay === undefined || typeof d.restDay === "boolean"),
        ) &&
        unique(p.days),
    )
  )
    throw Error("Invalid workout plans.");
  if (
    !s.workouts.every(workout) ||
    (s.active !== null && (!workout(s.active) || s.active.finished))
  )
    throw Error("Invalid workout records.");
  if (
    !s.body.every(
      (e) =>
        e &&
        id(e.id) &&
        date(e.date) &&
        str(e.notes) &&
        ["weight", "fat", "waist", "chest", "hips", "arm", "thigh"].some(
          (k) => e[k] !== undefined,
        ) &&
        ["weight", "fat", "waist", "chest", "hips", "arm", "thigh"].every(
          (k) => e[k] === undefined || numeric(e[k], k === "fat" ? 100 : 1000),
        ),
    )
  )
    throw Error("Invalid body measurements.");
  if (
    !s.equipment.every(
      (e) =>
        e &&
        id(e.id) &&
        str(e.name) &&
        typeof e.confirmed === "boolean" &&
        typeof e.unavailable === "boolean",
    )
  )
    throw Error("Invalid equipment.");
  if (
    !s.custom.every(
      (e) =>
        e &&
        id(e.id) &&
        str(e.name) &&
        str(e.equipment) &&
        str(e.level) &&
        str(e.category) &&
        strings(e.primaryMuscles) &&
        strings(e.secondaryMuscles) &&
        strings(e.required) &&
        strings(e.instructions) &&
        strings(e.images) &&
        strings(e.cues) &&
        strings(e.mistakes) &&
        (e.loadKind === undefined ||
          ["per-side", "stack", "plates"].includes(e.loadKind)) &&
        ["strength", "duration", "cardio"].includes(e.mode) &&
        (e.animation === undefined || str(e.animation)),
    )
  )
    throw Error("Invalid custom exercises.");
  if (!s.favourites.every(id)) throw Error("Invalid favourites.");
  for (const key of ["exerciseNotes", "setupNotes"])
    if (
      !s[key] ||
      Array.isArray(s[key]) ||
      typeof s[key] !== "object" ||
      !Object.values(s[key]).every(str)
    )
      throw Error("Invalid notes.");
  const prefs = s.settings;
  if (
    !prefs ||
    !["kg", "lb"].includes(prefs.weight) ||
    !["cm", "in"].includes(prefs.length) ||
    !["km", "mi"].includes(prefs.distance) ||
    !["off", "RIR", "RPE"].includes(prefs.effort) ||
    (prefs.theme !== undefined &&
      !["focus", "sumikko"].includes(prefs.theme)) ||
    (prefs.goal !== undefined && !numeric(prefs.goal, 1000)) ||
    (prefs.lastBackup !== undefined && !date(prefs.lastBackup)) ||
    (prefs.activePlanId !== undefined && !id(prefs.activePlanId)) ||
    (prefs.keepAwake !== undefined && typeof prefs.keepAwake !== "boolean") ||
    (prefs.weightIncrements !== undefined &&
      (!prefs.weightIncrements ||
        typeof prefs.weightIncrements !== "object" ||
        Array.isArray(prefs.weightIncrements) ||
        !Object.entries(prefs.weightIncrements).every(
          ([key, value]) => id(key) && numeric(value, 1000000) && value > 0,
        )))
  )
    throw Error("Invalid settings.");
  if (s.timer !== null && !numeric(s.timer, 1e15))
    throw Error("Invalid timer.");
  if (
    s.buddy !== undefined &&
    (!s.buddy ||
      !buddyPreferences(s.buddy.preferences) ||
      (s.buddy.draft !== undefined && !buddyDraft(s.buddy.draft)))
  )
    throw Error("Invalid Workout Buddy data.");
  for (const key of ["plans", "workouts", "body", "equipment", "custom"])
    if (!unique(s[key])) throw Error(`Duplicate IDs in ${key}.`);
  if (exerciseIds.length) {
    const known = new Set([...exerciseIds, ...s.custom.map((e) => e.id)]);
    const all = [
      ...s.workouts,
      ...(s.active ? [s.active] : []),
      ...s.plans.flatMap((p) => p.days),
      ...(s.buddy?.draft?.days ?? []),
    ];
    if (all.some((w) => w.movements.some((m) => !known.has(m.exerciseId))))
      throw Error("Backup references an unknown exercise.");
    if (s.buddy?.draft?.suggestions.some((x) => !known.has(x.exerciseId)))
      throw Error("Buddy suggestion references an unknown exercise.");
  }
  return structuredClone(s);
}
