import { test } from "node:test";
import assert from "node:assert/strict";
import { setIssue, sessionComparisons } from "../src/workout-feedback.mjs";
import { csvCell } from "../src/domain.mjs";
test("actual results require a known load, positive whole reps or positive time", () => {
  const e = { mode: "strength" };
  assert.equal(setIssue({ reps: 10, weight: 0 }, e), "");
  for (const reps of [0, -1, 1.5, NaN])
    assert.match(setIssue({ reps }, e), /whole number/);
  assert.match(setIssue({ reps: 10, needsLoad: true }, e), /Choose a load/);
  for (const mode of ["cardio", "duration"]) {
    assert.match(setIssue({ seconds: 0 }, { mode }), /duration/);
    assert.equal(setIssue({ seconds: 10 }, { mode }), "");
  }
});
test("session feedback compares completed working reps at the same load with the last completed session", () => {
  const sets = (reps, weight = 27.5) =>
    reps.map((n) => ({ reps: n, weight, done: true, type: "working" }));
  const current = {
    movements: [
      {
        id: "m",
        exerciseId: "bench",
        sets: [
          ...sets([10, 10, 8]),
          ...sets([5], 30),
          { ...sets([50])[0], type: "warmup" },
          { ...sets([100])[0], done: false },
        ],
      },
    ],
  };
  const history = [
    {
      started: "2026-10-01",
      finished: "2026-10-01",
      movements: [{ exerciseId: "bench", sets: sets([9, 9, 8]) }],
    },
    {
      started: "2026-10-06",
      movements: [{ exerciseId: "bench", sets: sets([100]) }],
    },
  ];
  const rows = sessionComparisons(current, history);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].reps, 28);
  assert.equal(rows[0].previousReps, 26);
  assert.equal(rows[0].sets, 3);
  assert.equal(rows[1].previousReps, undefined);
  assert.equal(history[0].movements[0].sets[0].reps, 9);
});
test("CSV output preserves quotes and newlines without executing imported text as spreadsheet formulas", () => {
  assert.equal(csvCell('He said "hello"\nAgain'), '"He said ""hello""\nAgain"');
  for (const text of [
    '=HYPERLINK("example")',
    "+SUM(1,2)",
    "@example",
    "\t=1+1",
    "-2+3",
  ])
    assert.ok(csvCell(text).startsWith("\"'"));
  assert.equal(csvCell(-2), '"-2"');
  assert.equal(csvCell(null), '""');
});
