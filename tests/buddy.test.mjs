import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  movementFamilies,
  tagsFor,
  defaultBuddyPreferences,
  eligibility,
  suggestExercises,
  buildDraft,
  starterMovement,
  chooseSuggestion,
  estimateMinutes,
} from "../src/buddy.mjs";
import { validateBackup } from "../src/domain.mjs";
import { planExercises } from "../src/prebuilt-plan.mjs";
const library = JSON.parse(
  fs.readFileSync(new URL("../src/data/exercises.json", import.meta.url)),
);
const exercises = [...library, ...planExercises];
const lookup = (id) => exercises.find((e) => e.id === id);
const baseline = () => ({
  version: 1,
  plans: [],
  workouts: [],
  active: null,
  body: [],
  equipment: [...new Set(exercises.flatMap((e) => e.required))]
    .filter((id) => id !== "body only")
    .map((id) => ({ id, name: id, confirmed: true, unavailable: false })),
  custom: structuredClone(planExercises),
  favourites: [],
  exerciseNotes: {},
  setupNotes: {},
  settings: { weight: "kg", length: "cm", distance: "km", effort: "off" },
  timer: null,
});
const prefs = () => ({ ...defaultBuddyPreferences(), experience: "advanced" });
const completed = (id) => ({
  ...starterMovement(lookup(id)),
  sets: starterMovement(lookup(id)).sets.map((t) => ({
    ...t,
    weight: 27.5,
    done: true,
    needsLoad: false,
  })),
});

test("curated movement tags use real catalogue IDs and equipment eligibility never assumes missing gear", () => {
  Object.values(movementFamilies)
    .flat()
    .forEach((id) => assert.ok(lookup(id), id));
  const s = baseline(),
    p = prefs();
  s.equipment = [];
  assert.equal(eligibility(lookup("Dumbbell_Bench_Press"), p, s).ok, false);
  assert.match(
    eligibility(lookup("Dumbbell_Bench_Press"), p, s).reason,
    /Confirm/,
  );
  assert.equal(eligibility(lookup("Pushups"), p, s).ok, true);
  s.equipment = [
    { id: "dumbbell", name: "Dumbbells", confirmed: true, unavailable: false },
  ];
  assert.match(
    eligibility(lookup("Dumbbell_Bench_Press"), p, s).reason,
    /bench/,
  );
  s.equipment = baseline().equipment;
  assert.equal(
    eligibility(lookup("Dumbbell_Bench_Press"), { ...p, equipmentIds: [] }, s)
      .ok,
    false,
  );
  const suggestions = suggestExercises({ ...s, equipment: [] }, exercises, {
    ...p,
    exerciseId: "Dumbbell_Bench_Press",
  });
  assert.ok(suggestions.length > 0);
  assert.ok(
    suggestions.every((x) =>
      lookup(x.exerciseId).required.every((id) => id === "body only"),
    ),
  );
});

test("restriction filters, exclusions and experience are explicit and deterministic", () => {
  const s = baseline(),
    p = prefs();
  assert.equal(
    eligibility(
      lookup("Dumbbell_Shoulder_Press"),
      { ...p, avoidOverhead: true },
      s,
    ).ok,
    false,
  );
  assert.equal(
    eligibility(lookup("Seated_Cable_Rows"), { ...p, avoidGrip: true }, s).ok,
    false,
  );
  assert.equal(
    eligibility(
      lookup("Hammer_Curls"),
      { ...p, exclusions: ["Hammer_Curls"] },
      s,
    ).ok,
    false,
  );
  assert.equal(
    eligibility(
      lookup("Barbell_Full_Squat"),
      { ...p, experience: "beginner" },
      s,
    ).ok,
    false,
  );
  const result = suggestExercises(s, exercises, {
    ...p,
    exerciseId: "Seated_Cable_Rows",
    avoidGrip: true,
  });
  assert.equal(result.length, 0);
});

test("replacement ranking matches patterns, prefers familiar choices and includes a new alternative", () => {
  const s = baseline();
  s.workouts = [
    {
      id: "history",
      name: "Previous",
      started: "2026-10-01T00:00:00Z",
      finished: "2026-10-01T01:00:00Z",
      notes: "",
      movements: [
        "Dumbbell_Bench_Press",
        "Barbell_Bench_Press_-_Medium_Grip",
        "Machine_Bench_Press",
      ].map(completed),
    },
  ];
  const result = suggestExercises(s, exercises, {
    ...prefs(),
    exerciseId: "Pushups",
  });
  assert.equal(result.length, 3);
  assert.ok(result.some((x) => x.newToYou));
  assert.ok(
    result.every(
      (x) => tagsFor(lookup(x.exerciseId)).pattern === "horizontal press",
    ),
  );
  assert.ok(result.some((x) => !x.newToYou));
});

test("adaptation trims optional exercises before reporting a budget conflict, preserves main targets and never mutates plans", () => {
  const s = baseline();
  const ids = [
    "Dumbbell_Bench_Press",
    "Wide-Grip_Lat_Pulldown",
    "Seated_Cable_Rows",
    "Incline_Dumbbell_Press",
    "Barbell_Squat",
    "Side_Lateral_Raise",
    "Hammer_Curls",
  ];
  const day = {
    id: "day",
    name: "Saved day",
    notes: "Keep this",
    movements: ids.map((id, i) => ({
      ...starterMovement(lookup(id)),
      optional: i >= 5,
      sets: starterMovement(lookup(id)).sets.map((t) => ({
        ...t,
        weight: i === 2 ? 63.75 : 25,
        reps: 8,
        needsLoad: false,
      })),
    })),
  };
  s.plans = [{ id: "plan", name: "Plan", days: [day], next: 0 }];
  const before = structuredClone(s);
  const p = {
    ...prefs(),
    mode: "adapt",
    sourcePlanId: "plan",
    sourceDayId: "day",
    sourceScope: "plan",
    minutes: 20,
  };
  const draft = buildDraft(s, exercises, p);
  assert.equal(draft.days[0].movements.length, 5);
  assert.equal(
    draft.changes.filter((x) => /Removed optional/.test(x)).length,
    2,
  );
  assert.ok(
    draft.warnings.some((x) => /Main targets were not reduced/.test(x)),
  );
  assert.equal(draft.days[0].movements[2].sets[0].weight, 63.75);
  assert.equal(draft.days[0].movements[2].sets[0].reps, 8);
  assert.deepEqual(s, before);
  const restricted = buildDraft(s, exercises, { ...p, avoidGrip: true });
  assert.ok(restricted.changes.some((x) => /excluded grip-heavy/.test(x)));
});

test("from-scratch routines and 2-5-day plans are editable, compatible, and contain no inferred loads", () => {
  const s = baseline();
  s.workouts = [
    {
      id: "history",
      name: "Previous",
      started: "2026-10-01T00:00:00Z",
      notes: "",
      movements: [completed("Dumbbell_Bench_Press")],
    },
  ];
  for (const frequency of [2, 3, 4, 5]) {
    const p = { ...prefs(), mode: "create", output: "plan", frequency };
    const draft = buildDraft(s, exercises, p);
    assert.equal(draft.days.length, frequency);
    draft.days.forEach((day) => {
      assert.ok(day.movements.length > 0);
      assert.ok(estimateMinutes(day, lookup) <= 40);
      day.movements.forEach((m) => {
        assert.ok(eligibility(lookup(m.exerciseId), p, s).ok);
        m.sets.forEach((t) => {
          assert.equal(t.weight, 0);
          assert.equal(t.done, false);
        });
      });
    });
    s.buddy = { preferences: p, draft };
    assert.doesNotThrow(() =>
      validateBackup(
        s,
        library.map((e) => e.id),
      ),
    );
  }
  const draft = buildDraft(s, exercises, {
    ...prefs(),
    mode: "create",
    sourcePlanId: "old",
    sourceDayId: "old-day",
  });
  assert.equal(draft.source, undefined);
});

test("replacement drafts retain targets but require new loads, including stack and per-side conventions", () => {
  const s = baseline();
  const original = starterMovement(lookup("Dumbbell_Bench_Press"));
  original.sets.forEach((t) => {
    t.weight = 27.5;
    t.needsLoad = false;
  });
  s.plans = [
    {
      id: "plan",
      name: "Plan",
      next: 0,
      days: [{ id: "day", name: "Day", movements: [original] }],
    },
  ];
  const draft = buildDraft(s, exercises, {
    ...prefs(),
    mode: "suggest",
    exerciseId: original.exerciseId,
    sourcePlanId: "plan",
    sourceDayId: "day",
    sourceMovementId: original.id,
  });
  const result = chooseSuggestion(
    draft,
    lookup(draft.suggestions[0].exerciseId),
  );
  assert.equal(result.days[0].movements[0].sets[0].weight, 0);
  assert.equal(result.days[0].movements[0].sets[0].reps, original.sets[0].reps);
  assert.equal(result.days[0].movements[0].rest, original.rest);
  for (const id of [
    "personal-trap-bar",
    "personal-lateral-machine",
    "personal-linear-leg-press",
  ]) {
    const m = starterMovement(lookup(id));
    assert.equal(m.exerciseId, id);
    assert.ok(m.sets.every((t) => t.needsLoad));
  }
});

test("Buddy backups round trip, accept old data, reject corrupt drafts and estimate shared rest", () => {
  const s = baseline();
  assert.doesNotThrow(() => validateBackup(s));
  s.buddy = { preferences: prefs(), draft: buildDraft(s, exercises, prefs()) };
  assert.deepEqual(validateBackup(s), s);
  const corrupt = structuredClone(s);
  corrupt.buddy.preferences.minutes = 30;
  assert.throws(() => validateBackup(corrupt), /Buddy/);
  const unknown = structuredClone(s);
  unknown.buddy.draft.days[0].movements[0].exerciseId = "not-real";
  assert.throws(
    () =>
      validateBackup(
        unknown,
        library.map((e) => e.id),
      ),
    /unknown exercise/,
  );
  const movements = [
    starterMovement(lookup("Dumbbell_Bench_Press")),
    starterMovement(lookup("Seated_Cable_Rows")),
  ];
  movements.forEach((m) => {
    m.sets = m.sets.slice(0, 2);
    m.superset = "A";
  });
  assert.equal(estimateMinutes({ movements }, lookup), 8);
  const none = buildDraft({ ...s, equipment: [] }, exercises, {
    ...prefs(),
    mode: "create",
    focus: "pull",
    avoidGrip: true,
  });
  assert.ok(none.warnings.length > 0);
  assert.ok(
    none.days[0].movements.every((m) =>
      lookup(m.exerciseId).required.every((id) => id === "body only"),
    ),
  );
});

test("adapting can retain an untagged saved exercise but explains uncheckable restrictions", () => {
  const s = baseline(),
    e = library.find((e) => e.mode === "strength" && !tagsFor(e).pattern);
  s.plans = [
    {
      id: "plan",
      name: "Plan",
      next: 0,
      days: [{ id: "day", name: "Day", movements: [starterMovement(e)] }],
    },
  ];
  const p = {
    ...prefs(),
    mode: "adapt",
    sourcePlanId: "plan",
    sourceDayId: "day",
  };
  assert.equal(buildDraft(s, exercises, p).days[0].movements.length, 1);
  const restricted = buildDraft(s, exercises, { ...p, avoidOverhead: true });
  assert.equal(restricted.days[0].movements.length, 0);
  assert.ok(restricted.changes.some((x) => /no curated movement tags/.test(x)));
  const corrupt = structuredClone(s);
  corrupt.plans[0].days[0].movements[0].sets[0].done = true;
  corrupt.plans[0].days[0].movements[0].sets[0].needsLoad = true;
  assert.throws(() => validateBackup(corrupt), /Invalid workout plans/);
});
