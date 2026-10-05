import { uid } from "./domain.mjs";
export const PERSONAL_TEMPLATE = "upper-lower-ppl-v1";
/** @returns {import('./types').Exercise} */
const custom = (
  id,
  name,
  required,
  muscles,
  instructions,
  loadKind = undefined,
) => ({
  id,
  name,
  required,
  primaryMuscles: muscles,
  secondaryMuscles: [],
  equipment: required[0],
  level: "intermediate",
  category: "strength",
  mode: "strength",
  images: [],
  instructions,
  cues: [instructions[0]],
  mistakes: [],
  ...(loadKind ? { loadKind } : {}),
});
export const planExercises = [
  custom(
    "personal-trap-bar",
    "Trap Bar Deadlift — per side",
    ["trap bar"],
    ["quadriceps", "glutes"],
    [
      "Record plates PER SIDE. The exact bar weight is unknown; do not treat this as total lifted weight.",
      "Stand centered inside the bar, brace, and push through the floor with a controlled lift and return.",
      "Established: 40 kg per side × 8 × 3. Do not increase until this is comfortably established again.",
    ],
    "per-side",
  ),
  custom(
    "personal-hip-thrust",
    "Barbell Hip Thrust",
    ["barbell", "bench"],
    ["glutes"],
    [
      "Support your upper back on a stable bench and position a padded bar across the hips.",
      "Keep ribs down and finish with the glutes. Do not hyperextend the lower back.",
      "Use a controlled movement and a brief squeeze at lockout.",
      "First established session: 70 kg TOTAL × 10 × 3, moderate. Next appropriate target about 80 kg; no automatic increase.",
    ],
  ),
  custom(
    "personal-lateral-machine",
    "Lateral Raise Machine — stack setting",
    ["lateral raise machine"],
    ["shoulders"],
    [
      "Adjust the seat and pads to the machine's setup instructions; raise and lower with control.",
      "Record the stack setting, not an assumed kilogram load. Current setting: 30, for 10–15 reps, about two sets.",
    ],
    "stack",
  ),
  custom(
    "personal-linear-leg-press",
    "Linear Leg Press — plates only",
    ["leg press"],
    ["quadriceps", "glutes"],
    [
      "Record the total plates added, excluding the 53 kg sled. Plates plus sled are described in your notes.",
      "Set up with your back supported; lower and press with control using a comfortable range.",
      "Historical best: 200 kg plates + 53 kg sled × 12 × 3. Choose today's load according to squat/deadlift fatigue.",
    ],
    "plates",
  ),
];

/** Creates a fresh editable plan; does not invent completed workout history.
 * @returns {import('./types').Plan} */
export function makePersonalPlan() {
  const move = (
    exerciseId,
    weight,
    reps,
    notes = "",
    range = [8, 10],
    optional = false,
  ) => ({
    id: uid(),
    exerciseId,
    rest: 90,
    notes,
    superset: "",
    repMin: range[0],
    repMax: range[1],
    optional,
    sets: reps.map((reps) => ({
      id: uid(),
      weight,
      reps,
      seconds: 60,
      distance: 0,
      type: "working",
      done: false,
    })),
  });
  const bench = () =>
    move(
      "Dumbbell_Bench_Press",
      27.5,
      [9, 10, 8],
      "27.5 kg EACH: last reported 9, 10, 8. Improve controlled reps here before 30 kg. Push volume should reflect Upper performance.",
      [8, 12],
    );
  const pulldown = () =>
    move(
      "Wide-Grip_Lat_Pulldown",
      60,
      [8, 8, 8],
      "Current: 60 kg × 8 × 3. Build toward 3 × 10 before increasing.",
    );
  const row = () =>
    move(
      "Seated_Cable_Rows",
      63.75,
      [8, 8, 8],
      "Current: 63.75 kg × 8 × 3. Build toward 3 × 10.",
    );
  const incline = () =>
    move(
      "Incline_Dumbbell_Press",
      25,
      [8, 8, 8],
      "Bench about 30°. 25 kg EACH × 8 × 3; build toward 3 × 10. Push alternative: incline barbell; historical 40 × 8, 50 × 8, 55 × 6. Replace in Overview if desired.",
    );
  const reverse = () =>
    move(
      "Reverse_Machine_Flyes",
      42.5,
      [8, 8, 8],
      "Reverse pec deck: 42.5 kg × 8 × 3. Build reps before increasing.",
    );
  const lateral = () =>
    move(
      "personal-lateral-machine",
      30,
      [12, 12],
      "Stack setting 30 (unit not assumed), 10–15 reps for about two sets. 12 is an editable target within your range.",
      [10, 15],
    );
  const hammer = (optional) =>
    move(
      "Hammer_Curls",
      12.5,
      [10, 10],
      "About 12.5 kg EACH when appropriate. Two sets of 10 are editable placeholders, not reported performance. Reduce or skip with badminton-related forearm soreness.",
      [8, 12],
      optional,
    );
  const squat = (lighter) =>
    move(
      "Barbell_Squat",
      95,
      [8, 8, 8],
      `${lighter ? "Lighter/moderate than Lower if needed; adjust the 95 kg starting target down for fatigue. " : "Current volume load about 95 kg. "}Historical best: 100 kg × 8 × 3. Recent: 100 × 6 tough + 90 × 8 × 2; 100 × 8 tough + 95 × 8 × 2 moderate. Rebuild comfortable, consistent 100 × 8 sets before exceeding 100.`,
      [6, 8],
    );
  const legPress = () =>
    move(
      "personal-linear-leg-press",
      0,
      [12, 12, 12],
      "Choose today's PLATES ONLY load; 0 means not yet selected. Sled is 53 kg. Historical best 200 kg plates + sled × 12 × 3, not an automatic target. Reduce load/sets according to fatigue.",
      [10, 12],
    );
  const extension = () =>
    move(
      "Leg_Extensions",
      100,
      [10, 10],
      "About 100 kg × 10–12 × 2.",
      [10, 12],
    );
  const calves = () =>
    move(
      "Standing_Calf_Raises",
      0,
      [12, 12],
      "Optional calves; select a load and confirm your available machine. Two sets of 12 are editable placeholders, not reported performance.",
      [10, 15],
      true,
    );
  const core = () =>
    move(
      "Plank",
      0,
      [0],
      "Optional core example: plank. The 60-second duration is an editable placeholder; choose your own duration or replace with your preferred core exercise.",
      [0, 0],
      true,
    );
  const day = (name, movements, notes, restDay = false) => ({
    id: uid(),
    name,
    movements,
    notes,
    restDay,
  });
  return {
    id: uid(),
    templateId: PERSONAL_TEMPLATE,
    name: "Upper / Lower / Push / Pull / Legs",
    next: 0,
    notes:
      "Suggested seven-day sequence, not a fixed calendar. Take extra rest for recovery or sport without advancing the next workout. Lower emphasizes squat/trap-bar strength; Legs emphasizes glutes/hypertrophy. Distribute fatigue: hip thrusts must not simply sit on top of maximum squat + trap-bar + leg-press volume. Loads are your reported starting points, not automatically prescribed increases. Default rest is 90 seconds; edit it to suit you.",
    days: [
      day(
        "Day 1 — Upper",
        [
          bench(),
          pulldown(),
          row(),
          incline(),
          reverse(),
          lateral(),
          hammer(true),
        ],
        "Optional hammer curls are skipped by default; use Overview → Guide this exercise to include them when appropriate.",
      ),
      day(
        "Day 2 — Lower · Strength",
        [
          squat(false),
          move(
            "personal-trap-bar",
            40,
            [8, 8, 8],
            "40 kg PER SIDE × 8 × 3. Exact bar weight unknown. Do not increase until comfortably established again.",
          ),
          legPress(),
          extension(),
          calves(),
          core(),
        ],
        "Optional calves/core are skipped by default; include or replace them if desired. Adjust leg-press volume for squat/deadlift fatigue.",
      ),
      day(
        "Day 3 — Rest / activity",
        [],
        "Rest or activity according to recovery and sport. Continue to Push whenever ready; no calendar deadline.",
        true,
      ),
      day(
        "Day 4 — Push",
        [
          bench(),
          incline(),
          move(
            "Leverage_Shoulder_Press",
            20,
            [8, 8, 8],
            "Only if the right shoulder feels stable. Historical machine performance: 20 × 8, 8, 14. These 8-rep targets are editable, not a new recorded session. No painful ROM, bouncing, or ugly grinders.",
            [8, 14],
            true,
          ),
          lateral(),
          move(
            "Triceps_Pushdown",
            0,
            [10, 10],
            "Choose today's comfortable load; none was supplied. Two sets of 10 are editable placeholders. Replace with your preferred triceps extension if desired.",
            [8, 12],
          ),
        ],
        "Use free weights for main presses when available. Monitor previous right-shoulder instability. Shoulder press is optional and skipped by default.",
      ),
      day(
        "Day 5 — Pull",
        [pulldown(), row(), reverse(), hammer(false)],
        "If forearms are sore from badminton, reduce pulling/grip volume and skip curls if needed. Optional extra back/biceps work only when recovered; add through Overview.",
      ),
      day(
        "Day 6 — Legs · Glutes",
        [
          squat(true),
          move(
            "personal-hip-thrust",
            70,
            [10, 10, 10],
            "NEW: first established 70 kg TOTAL × 10 × 3, moderate. Next appropriate target about 80 kg when controlled; adjust manually. Ribs down, finish with glutes, no lower-back hyperextension, brief squeeze at lockout.",
            [10, 10],
          ),
          legPress(),
          extension(),
          move(
            "Lying_Leg_Curls",
            0,
            [10, 10],
            "Optional, only if available. Select your load; two sets of 10 are editable placeholders, not reported performance.",
            [8, 12],
            true,
          ),
          calves(),
        ],
        "Balance fatigue with Lower. Hip thrusts add meaningful volume; reduce squat/deadlift/leg-press volume as needed. Optional hamstring curl and calves are skipped by default.",
      ),
      day(
        "Day 7 — Rest",
        [],
        "Take rest. Restart Upper when recovered; extra rest never forces a calendar catch-up.",
        true,
      ),
    ],
  };
}

/** @param {import('./types').State} state */
export function installPersonalPlan(state) {
  const existing = state.plans.find((p) => p.templateId === PERSONAL_TEMPLATE);
  if (existing) return existing.id;
  for (const e of planExercises) {
    if (!state.custom.some((x) => x.id === e.id)) state.custom.push(e);
    for (const id of e.required)
      if (!state.equipment.some((x) => x.id === id))
        state.equipment.push({
          id,
          name:
            id === "trap bar"
              ? "Trap bar"
              : id === "lateral raise machine"
                ? "Lateral raise machine"
                : id,
          confirmed: false,
          unavailable: false,
        });
  }
  const plan = makePersonalPlan();
  state.plans.push(plan);
  return plan.id;
}
