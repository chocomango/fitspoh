import { uid, available } from "./domain.mjs";

/** Curated movement families; unknown movements are not guessed into recommendations. */
export const movementFamilies = {
  "horizontal press": [
    "Dumbbell_Bench_Press",
    "Barbell_Bench_Press_-_Medium_Grip",
    "Machine_Bench_Press",
    "Pushups",
    "Push-Up_Wide",
  ],
  "incline press": [
    "Incline_Dumbbell_Press",
    "Barbell_Incline_Bench_Press_-_Medium_Grip",
    "Smith_Machine_Incline_Bench_Press",
  ],
  "overhead press": [
    "Dumbbell_Shoulder_Press",
    "Barbell_Shoulder_Press",
    "Leverage_Shoulder_Press",
    "Seated_Cable_Shoulder_Press",
  ],
  "vertical pull": [
    "Wide-Grip_Lat_Pulldown",
    "Close-Grip_Front_Lat_Pulldown",
    "V-Bar_Pulldown",
    "Pullups",
    "Chin-Up",
  ],
  "horizontal pull": [
    "Seated_Cable_Rows",
    "One-Arm_Dumbbell_Row",
    "Bent_Over_Barbell_Row",
    "Elevated_Cable_Rows",
  ],
  squat: [
    "Barbell_Squat",
    "Barbell_Full_Squat",
    "Goblet_Squat",
    "Dumbbell_Squat",
    "Bodyweight_Squat",
    "Leg_Press",
    "personal-linear-leg-press",
  ],
  hinge: [
    "Barbell_Deadlift",
    "Romanian_Deadlift",
    "Stiff-Legged_Dumbbell_Deadlift",
    "personal-trap-bar",
  ],
  "hip extension": [
    "personal-hip-thrust",
    "Single_Leg_Glute_Bridge",
    "Glute_Kickback",
    "Butt_Lift_Bridge",
  ],
  "knee extension": ["Leg_Extensions", "Single-Leg_Leg_Extension"],
  "knee flexion": ["Lying_Leg_Curls", "Seated_Leg_Curl", "Standing_Leg_Curl"],
  "lateral raise": [
    "Side_Lateral_Raise",
    "Seated_Side_Lateral_Raise",
    "Cable_Seated_Lateral_Raise",
    "personal-lateral-machine",
  ],
  "rear delts": [
    "Reverse_Machine_Flyes",
    "Cable_Rear_Delt_Fly",
    "Seated_Bent-Over_Rear_Delt_Raise",
  ],
  "elbow flexion": [
    "Hammer_Curls",
    "Barbell_Curl",
    "Dumbbell_Bicep_Curl",
    "Alternate_Hammer_Curl",
    "Concentration_Curls",
    "Preacher_Curl",
  ],
  "elbow extension": [
    "Triceps_Pushdown",
    "Triceps_Pushdown_-_Rope_Attachment",
    "Triceps_Pushdown_-_V-Bar_Attachment",
    "Dumbbell_One-Arm_Triceps_Extension",
  ],
  calves: [
    "Standing_Calf_Raises",
    "Seated_Calf_Raise",
    "Calf_Press_On_The_Leg_Press_Machine",
  ],
  core: ["Plank", "Crunches", "Dead_Bug", "Bent-Knee_Hip_Raise"],
};
const gripFamilies = new Set([
  "vertical pull",
  "horizontal pull",
  "hinge",
  "elbow flexion",
]);
const handLoaded = /dumbbell|barbell|kettlebell|cable|trap bar/;
export const tagsFor = (e) => {
  const pattern = Object.entries(movementFamilies).find(([, ids]) =>
    ids.includes(e.id),
  )?.[0];
  return {
    pattern,
    overhead:
      pattern === "overhead press" ||
      e.id === "Dumbbell_One-Arm_Triceps_Extension",
    grip:
      gripFamilies.has(pattern) ||
      (handLoaded.test(e.equipment) &&
        ["squat", "hip extension", "lateral raise", "rear delts"].includes(
          pattern,
        )),
  };
};

/** @returns {import('./types').BuddyPreferences} */
export function defaultBuddyPreferences() {
  return {
    mode: "create",
    output: "routine",
    experience: "intermediate",
    focus: "full-body",
    minutes: 40,
    frequency: 3,
    avoidOverhead: false,
    avoidGrip: false,
    exclusions: [],
  };
}

/** @param {import('./types').Exercise} e @param {import('./types').BuddyPreferences} p @param {import('./types').State} state */
export function eligibility(e, p, state, requireTags = true) {
  const tags = tagsFor(e);
  if (!tags.pattern && (requireTags || p.avoidGrip || p.avoidOverhead))
    return {
      ok: false,
      reason:
        "This exercise has no curated movement tags to check the requested restrictions or suggest alternatives yet.",
    };
  if (p.exclusions.includes(e.id))
    return { ok: false, reason: "You excluded this exercise." };
  if (p.avoidOverhead && tags.overhead)
    return { ok: false, reason: "You excluded overhead presses." };
  if (p.avoidGrip && tags.grip)
    return { ok: false, reason: "You excluded grip-heavy exercises." };
  const levels = ["beginner", "intermediate", "advanced"];
  if (levels.indexOf(e.level) > levels.indexOf(p.experience))
    return { ok: false, reason: "Above the selected experience level." };
  const equipment = state.equipment.filter(
    (x) => p.equipmentIds === undefined || p.equipmentIds.includes(x.id),
  );
  if (!available(e, equipment)) {
    const missing = e.required.filter(
      (id) =>
        id !== "body only" &&
        !equipment.some((x) => x.id === id && x.confirmed && !x.unavailable),
    );
    return {
      ok: false,
      reason: `Confirm and select equipment: ${missing.map((id) => state.equipment.find((x) => x.id === id)?.name ?? id).join(", ")}.`,
    };
  }
  return {
    ok: true,
    reason: "Uses your selected, confirmed equipment or bodyweight.",
  };
}

/** @param {import('./types').State} state @returns {import('./types').Movement|undefined} */
export function lastCompleted(state, exerciseId) {
  for (const w of [...state.workouts].sort((a, b) =>
    b.started.localeCompare(a.started),
  )) {
    const m = w.movements.find(
      (m) =>
        m.exerciseId === exerciseId &&
        m.sets.some((t) => t.done && t.type !== "warmup"),
    );
    if (m) return m;
  }
}
const familiar = (state, id) => !!lastCompleted(state, id);
const rank = (e, state) =>
  (familiar(state, e.id) ? 20 : 0) + (state.favourites.includes(e.id) ? 10 : 0);

/** @param {import('./types').State} state @param {import('./types').Exercise[]} exercises @param {import('./types').BuddyPreferences} p */
export function suggestExercises(state, exercises, p) {
  const source = exercises.find((e) => e.id === p.exerciseId);
  const sourceTags = source && tagsFor(source);
  let pool = exercises.filter(
    (e) => e.id !== source?.id && eligibility(e, p, state).ok,
  );
  if (source) {
    const same = pool.filter(
      (e) => sourceTags.pattern && tagsFor(e).pattern === sourceTags.pattern,
    );
    pool = same.length
      ? same
      : pool.filter((e) =>
          e.primaryMuscles.some((m) => source.primaryMuscles.includes(m)),
        );
  } else
    pool = pool.filter((e) => e.primaryMuscles.includes(p.muscle || "chest"));
  pool.sort(
    (a, b) => rank(b, state) - rank(a, state) || a.name.localeCompare(b.name),
  );
  const selected = pool.slice(0, 3);
  const novel = pool.find((e) => !familiar(state, e.id));
  if (
    novel &&
    selected.length === 3 &&
    selected.every((e) => familiar(state, e.id))
  )
    selected[2] = novel;
  return selected.map((e) => ({
    exerciseId: e.id,
    newToYou: !familiar(state, e.id),
    reason: `${source && sourceTags.pattern === tagsFor(e).pattern ? `Same ${sourceTags.pattern} movement pattern` : `Targets ${e.primaryMuscles.join(", ")}; review the different movement`}. ${familiar(state, e.id) ? "You've logged this exercise before." : "New to your recorded workouts."} ${state.favourites.includes(e.id) ? "One of your favourites. " : ""}Uses selected, confirmed equipment or bodyweight.`,
  }));
}

/** @param {import('./types').Exercise} e @returns {import('./types').Movement} */
export function starterMovement(e) {
  return {
    id: uid(),
    exerciseId: e.id,
    rest: 90,
    notes:
      "Editable starter targets, not recorded performance. Choose your own load; no automatic increase.",
    superset: "",
    repMin: e.mode === "strength" ? 8 : 0,
    repMax: e.mode === "strength" ? 12 : 0,

    sets: Array.from({ length: e.mode === "strength" ? 3 : 1 }, () => ({
      id: uid(),
      weight: 0,
      reps: e.mode === "strength" ? 10 : 0,
      seconds: 60,
      distance: 0,
      type: "working",
      done: false,
      needsLoad:
        e.mode === "strength" && e.required.some((id) => id !== "body only"),
    })),
  };
}
/** @param {import('./types').Movement[]} movements @returns {import('./types').Movement[]} */
export function freshMovements(movements) {
  return structuredClone(movements).map((m) => ({
    ...m,
    id: uid(),
    sets: m.sets.map((t) => ({ ...t, id: uid(), done: false, skipped: false })),
  }));
}
/** Estimates seconds including sets, rest, setup and transitions; grouped rounds share rest. */
export function estimateMinutes(day, lookup) {
  let seconds = day.movements.length * 90;
  const groups = new Set();
  for (const m of day.movements) {
    seconds += m.sets.reduce(
      (n, t) =>
        n + (lookup(m.exerciseId)?.mode === "strength" ? 45 : t.seconds),
      0,
    );
    if (!m.superset) seconds += Math.max(0, m.sets.length - 1) * m.rest;
    else if (!groups.has(m.superset)) {
      groups.add(m.superset);
      const group = day.movements.filter((x) => x.superset === m.superset);
      seconds +=
        Math.max(0, Math.max(...group.map((x) => x.sets.length)) - 1) *
        Math.max(...group.map((x) => x.rest));
    }
  }
  return Math.ceil(seconds / 60);
}
const templates = {
  "full-body": [
    "squat",
    "horizontal press",
    "horizontal pull",
    "hip extension",
    "vertical pull",
    "core",
  ],
  upper: [
    "horizontal press",
    "vertical pull",
    "horizontal pull",
    "incline press",
    "rear delts",
    "lateral raise",
  ],
  lower: ["squat", "hinge", "knee extension", "knee flexion", "calves", "core"],
  legs: [
    "squat",
    "hip extension",
    "knee extension",
    "knee flexion",
    "calves",
    "core",
  ],
  push: [
    "horizontal press",
    "incline press",
    "overhead press",
    "lateral raise",
    "elbow extension",
  ],
  pull: [
    "vertical pull",
    "horizontal pull",
    "rear delts",
    "elbow flexion",
    "core",
  ],
};
const splits = {
  2: ["full-body", "full-body"],
  3: ["full-body", "full-body", "full-body"],
  4: ["upper", "lower", "upper", "lower"],
  5: ["upper", "lower", "push", "pull", "legs"],
};

/** @param {import('./types').State} state @param {import('./types').Exercise[]} exercises @param {import('./types').BuddyPreferences} p @returns {import('./types').BuddyDraft} */
export function buildDraft(state, exercises, p) {
  const lookup = (id) => exercises.find((e) => e.id === id);
  const draft = {
    id: uid(),
    name: p.mode === "adapt" ? "Adapted workout" : "Buddy draft",
    days: [],
    changes: [],
    warnings: [],
    reasons: {},
    suggestions: [],
  };
  if (
    p.mode !== "create" &&
    (p.mode !== "suggest" || p.exerciseId) &&
    p.sourceScope === "active" &&
    state.active
  )
    draft.source = {
      workoutId: state.active.id,
      movementId: p.sourceMovementId,
      snapshot: {
        id: state.active.id,
        name: state.active.name,
        movements: structuredClone(state.active.movements),
      },
    };
  else if (
    p.mode !== "create" &&
    (p.mode !== "suggest" || p.exerciseId) &&
    p.sourcePlanId &&
    p.sourceDayId
  ) {
    const original = state.plans
      .find((x) => x.id === p.sourcePlanId)
      ?.days.find((x) => x.id === p.sourceDayId);
    if (original)
      draft.source = {
        planId: p.sourcePlanId,
        dayId: p.sourceDayId,
        movementId: p.sourceMovementId,
        snapshot: structuredClone(original),
      };
  }
  if (p.mode === "suggest") {
    draft.name = "Exercise alternatives";
    draft.suggestions = suggestExercises(state, exercises, p);
    if (draft.suggestions.length < 3)
      draft.warnings.push(
        `Found ${draft.suggestions.length} compatible options. Confirm equipment, adjust exclusions, or choose another muscle to broaden the options.`,
      );
    return draft;
  }
  if (p.mode === "adapt") {
    if (
      !draft.source ||
      !draft.source.snapshot.movements.length ||
      draft.source.snapshot.restDay
    ) {
      draft.warnings.push(
        "Choose a saved training day with exercises. Rest days have no workout to adapt.",
      );
      return draft;
    }
    const day = {
      ...structuredClone(draft.source.snapshot),
      id: uid(),
      name: `${draft.source.snapshot.name} · Buddy draft`,
      movements: [],
    };
    for (const m of draft.source.snapshot.movements) {
      const e = lookup(m.exerciseId);
      const result = e && eligibility(e, p, state, false);
      if (!result?.ok) {
        draft.changes.push(
          `Omitted ${e?.name ?? m.exerciseId}: ${result?.reason ?? "Exercise unavailable."}`,
        );
        continue;
      }
      const copy = freshMovements([m])[0];
      day.movements.push(copy);
      draft.reasons[copy.id] =
        "Retained your saved exercise and all set, rep, load, and rest targets.";
    }
    while (
      estimateMinutes(day, lookup) > p.minutes &&
      day.movements.some((m) => m.optional)
    ) {
      const i = day.movements.findLastIndex((m) => m.optional);
      const removed = day.movements.splice(i, 1)[0];
      draft.changes.push(
        `Removed optional ${lookup(removed.exerciseId)?.name} to shorten the session.`,
      );
      delete draft.reasons[removed.id];
    }
    if (estimateMinutes(day, lookup) > p.minutes)
      draft.warnings.push(
        `The retained main exercises need an estimated ${estimateMinutes(day, lookup)} minutes, over your ${p.minutes}-minute budget. Main targets were not reduced. Edit the draft or change the budget.`,
      );
    if (!day.movements.length)
      draft.warnings.push(
        "No exercises remain eligible. Change your equipment or restrictions before accepting a draft.",
      );
    draft.days.push(day);
    draft.name = day.name;
    return draft;
  }
  const focuses = p.output === "plan" ? splits[p.frequency] : [p.focus];
  const usedByFamily = {};
  const desired = p.minutes === 20 ? 3 : p.minutes === 40 ? 5 : 6;
  focuses.forEach((focus, index) => {
    const day = {
      id: uid(),
      name: `${focus.replace("-", " ")} ${index + 1}`,
      movements: [],
      notes:
        "Draft targets are editable. Take rest between sessions whenever needed; there is no calendar catch-up.",
    };
    for (const family of templates[focus]) {
      if (day.movements.length >= desired) break;
      const candidates = exercises.filter(
        (e) =>
          tagsFor(e).pattern === family &&
          eligibility(e, p, state).ok &&
          !day.movements.some((m) => m.exerciseId === e.id),
      );
      candidates.sort(
        (a, b) =>
          rank(b, state) - rank(a, state) ||
          (usedByFamily[a.id] ?? 0) - (usedByFamily[b.id] ?? 0) ||
          a.name.localeCompare(b.name),
      );
      const e = candidates[0];
      if (!e) {
        draft.warnings.push(
          `${day.name}: no eligible ${family} exercise. Confirm equipment or adjust restrictions; no substitute was assumed.`,
        );
        continue;
      }
      usedByFamily[e.id] = (usedByFamily[e.id] ?? 0) + 1;
      const m = starterMovement(e);
      if (p.minutes === 20) m.sets = m.sets.slice(0, 2);
      m.optional = day.movements.length >= 3;
      day.movements.push(m);
      draft.reasons[m.id] =
        `${family} slot for ${focus}. ${familiar(state, e.id) ? "Familiar from your history." : "New to your recorded workouts."} ${eligibility(e, p, state).reason}`;
    }
    while (
      estimateMinutes(day, lookup) > p.minutes &&
      day.movements.some((m) => m.optional)
    ) {
      const removed = day.movements.pop();
      draft.changes.push(
        `${day.name}: removed optional ${lookup(removed.exerciseId)?.name} for the time budget.`,
      );
      delete draft.reasons[removed.id];
    }
    if (!day.movements.length)
      draft.warnings.push(
        `${day.name}: no compatible exercises. Change requirements before saving.`,
      );
    if (estimateMinutes(day, lookup) > p.minutes)
      draft.warnings.push(
        `${day.name}: estimated duration exceeds the budget. Review and edit the draft.`,
      );
    draft.days.push(day);
  });
  draft.name =
    p.output === "plan"
      ? `${p.frequency}-day Buddy plan`
      : `${p.focus.replace("-", " ")} routine`;
  return draft;
}

/** @param {import('./types').BuddyDraft} draft @param {import('./types').Exercise} e */
export function chooseSuggestion(draft, e) {
  const result = structuredClone(draft);
  const original = draft.source?.snapshot.movements.find(
    (m) => m.id === draft.source?.movementId,
  );
  const m = original
    ? {
        ...freshMovements([original])[0],
        exerciseId: e.id,
        notes: `Replacement draft for ${original.exerciseId}. Review the new exercise's guide and choose its load.`,
        sets: original.sets.map((t) => ({
          ...t,
          id: uid(),
          weight: 0,
          done: false,
          skipped: false,
          needsLoad:
            e.mode === "strength" &&
            e.required.some((id) => id !== "body only"),
        })),
      }
    : starterMovement(e);
  result.days = [
    {
      id: uid(),
      name: `Try ${e.name}`,
      movements: [m],
      notes: "Review this exercise before adding it to your routine.",
    },
  ];
  result.reasons[m.id] =
    draft.suggestions.find((x) => x.exerciseId === e.id)?.reason ??
    "Chosen from eligible alternatives.";
  result.name = `Try ${e.name}`;
  return result;
}
