import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  available,
  volume,
  rollingWeight,
  toStoredWeight,
  toDisplayWeight,
  toStoredLength,
  toDisplayLength,
  toStoredDistance,
  toDisplayDistance,
  validateBackup,
} from "../src/domain.mjs";
const baseline = () => ({
  version: 1,
  plans: [],
  workouts: [],
  active: null,
  body: [],
  equipment: [],
  custom: [],
  favourites: [],
  exerciseNotes: {},
  setupNotes: {},
  settings: { weight: "kg", length: "cm", distance: "km", effort: "off" },
  timer: null,
});
test("guided backups retain progress and skipped sets, accept older sessions, reject malformed progress", () => {
  const state = baseline();
  state.active = {
    id: "active",
    name: "Workout",
    started: "2026-10-05T10:00:00Z",
    notes: "",
    movements: [
      {
        id: "movement",
        exerciseId: "exercise",
        rest: 90,
        notes: "",
        superset: "",
        repMin: 8,
        repMax: 12,
        sets: [
          {
            id: "set",
            weight: 20,
            reps: 10,
            seconds: 60,
            distance: 0,
            type: "working",
            done: false,
            skipped: true,
          },
        ],
      },
    ],
    guided: {
      phase: "rest",
      setId: "set",
      lastSetId: "removed-set",
      overview: false,
      draft: { setId: "set", values: { weight: "27.", reps: "" } },
    },
  };
  state.timer = Date.now() + 90000;
  assert.deepEqual(validateBackup(state), state);
  const older = structuredClone(state);
  delete older.active.guided;
  delete older.active.movements[0].sets[0].skipped;
  assert.doesNotThrow(() => validateBackup(older));
  for (const progress of [
    { phase: "unknown" },
    { phase: "entry", setId: 3 },
    { phase: "rest", overview: "true" },
  ]) {
    const bad = structuredClone(state);
    bad.active.guided = progress;
    assert.throws(() => validateBackup(bad), /Invalid workout records/);
  }
  const bad = structuredClone(state);
  bad.active.movements[0].sets[0].skipped = "yes";
  assert.throws(() => validateBackup(bad), /Invalid workout records/);
});
test("gym availability requires every equipment item to be confirmed and usable", () => {
  const ex = { required: ["dumbbell", "bench"] };
  const eq = [
    { id: "dumbbell", confirmed: true, unavailable: false },
    { id: "bench", confirmed: false, unavailable: false },
  ];
  assert.equal(available(ex, eq), false);
  eq[1].confirmed = true;
  assert.equal(available(ex, eq), true);
  eq[0].unavailable = true;
  assert.equal(available(ex, eq), false);
  assert.equal(available({ required: [] }, eq), true);
});
test("unit conversions round trip without changing stored data", () => {
  for (const n of [0, 1, 75.5, 200]) {
    assert.ok(
      Math.abs(toStoredWeight(toDisplayWeight(n, "lb"), "lb") - n) < 1e-9,
    );
    assert.ok(
      Math.abs(toStoredLength(toDisplayLength(n, "in"), "in") - n) < 1e-9,
    );
    assert.ok(
      Math.abs(toStoredDistance(toDisplayDistance(n, "mi"), "mi") - n) < 1e-9,
    );
  }
});
test("volume excludes warmups and incomplete sets", () =>
  assert.equal(
    volume({
      movements: [
        {
          sets: [
            { done: true, type: "working", weight: 40, reps: 10 },
            { done: true, type: "warmup", weight: 20, reps: 10 },
            { done: false, type: "working", weight: 50, reps: 10 },
            { done: true, type: "drop", weight: 30, reps: 5 },
          ],
        },
      ],
    }),
    550,
  ));
test("rolling weight only uses recorded samples in trailing seven days", () => {
  const entries = [
    { date: "2026-01-01T08:00:00Z", weight: 80 },
    { date: "2026-01-03T08:00:00Z", weight: 78 },
    { date: "2026-01-08T08:00:00Z", weight: 76 },
    { date: "2026-01-09T08:00:00Z", waist: 85 },
  ];
  assert.deepEqual(
    rollingWeight(entries).map((e) => e.value),
    [80, 79, 77],
  );
});
test("backup accepts full body stats, round trips independently, rejects corrupt values", () => {
  const original = baseline();
  original.body = [
    {
      id: "body1",
      date: "2026-01-01T08:00:00Z",
      weight: 75,
      fat: 20,
      waist: 80,
      notes: "morning",
    },
  ];
  const imported = validateBackup(
    JSON.parse(JSON.stringify({ format: "fitspoh-backup", data: original })),
  );
  assert.deepEqual(imported, original);
  imported.body[0].weight = 1;
  assert.equal(original.body[0].weight, 75);
  assert.throws(() => validateBackup({ ...original, version: 9 }));
  assert.throws(() =>
    validateBackup({ ...original, body: [{ ...original.body[0], fat: 101 }] }),
  );
  assert.throws(() =>
    validateBackup({ ...original, equipment: [{ id: "x", name: "bench" }] }),
  );
  assert.throws(() =>
    validateBackup({ ...original, body: [original.body[0], original.body[0]] }),
  );
});
test("library has complete written guides and position photos", () => {
  const exercises = JSON.parse(
    fs.readFileSync(new URL("../src/data/exercises.json", import.meta.url)),
  );
  assert.ok(exercises.length >= 200);
  assert.equal(new Set(exercises.map((e) => e.id)).size, exercises.length);
  for (const e of exercises) {
    assert.ok(
      e.name &&
        e.instructions.length &&
        e.images.length &&
        e.primaryMuscles.length,
    );
    assert.ok(Array.isArray(e.required) && e.cues.length && e.mistakes.length);
    for (const image of e.images) {
      const bytes = fs.readFileSync(
        new URL(`../public/exercises/${image}`, import.meta.url),
      );
      assert.ok(bytes.length > 100);
      assert.equal(bytes.readUInt16BE(0), 0xffd8);
    }
  }
});
test("volume excludes assisted machines and cardio when exercise metadata is supplied", () => {
  const w = {
    movements: [
      {
        exerciseId: "assisted",
        sets: [{ done: true, type: "working", weight: 50, reps: 10 }],
      },
      {
        exerciseId: "press",
        sets: [{ done: true, type: "working", weight: 20, reps: 10 }],
      },
      {
        exerciseId: "bike",
        sets: [{ done: true, type: "working", weight: 5, reps: 10 }],
      },
    ],
  };
  const metadata = {
    assisted: { mode: "strength", name: "Assisted Pull-up" },
    press: { mode: "strength", name: "Dumbbell Press" },
    bike: { mode: "cardio", name: "Bike" },
  };
  assert.equal(
    volume(w, (id) => metadata[id]),
    200,
  );
});
test("theme backups accept old settings and supported themes, rejecting unknown values", () => {
  const original = baseline();
  assert.equal(validateBackup(original).settings.theme, undefined);
  for (const theme of ["focus", "sumikko"])
    assert.equal(
      validateBackup({ ...original, settings: { ...original.settings, theme } })
        .settings.theme,
      theme,
    );
  assert.throws(
    () =>
      validateBackup({
        ...original,
        settings: { ...original.settings, theme: "unknown" },
      }),
    /Invalid settings/,
  );
});
