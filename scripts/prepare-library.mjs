import fs from "node:fs";
const source = JSON.parse(fs.readFileSync("exercise-source.json", "utf8"));
const animationFor = (name) => {
  const mappings = [
    [
      "squat",
      [
        "Barbell Full Squat",
        "Barbell Squat",
        "Bodyweight Squat",
        "Dumbbell Squat",
        "Goblet Squat",
        "Front Barbell Squat",
        "Smith Machine Squat",
      ],
    ],
    [
      "curl",
      [
        "Barbell Curl",
        "Dumbbell Bicep Curl",
        "Hammer Curls",
        "Alternate Hammer Curl",
        "Alternate Incline Dumbbell Curl",
        "Concentration Curls",
        "Preacher Curl",
        "Cable Hammer Curls - Rope Attachment",
      ],
    ],
    [
      "press",
      [
        "Barbell Bench Press - Medium Grip",
        "Dumbbell Bench Press",
        "Incline Dumbbell Press",
        "Incline Barbell Bench Press",
        "Decline Dumbbell Bench Press",
      ],
    ],
    [
      "overhead",
      [
        "Dumbbell Shoulder Press",
        "Seated Dumbbell Press",
        "Standing Military Press",
        "Seated Barbell Military Press",
      ],
    ],
    [
      "raise",
      [
        "Side Lateral Raise",
        "Front Dumbbell Raise",
        "Seated Side Lateral Raise",
        "Front Plate Raise",
      ],
    ],
    [
      "row",
      [
        "Bent Over Barbell Row",
        "One-Arm Dumbbell Row",
        "Seated Cable Rows",
        "T-Bar Row",
      ],
    ],
    [
      "hinge",
      [
        "Barbell Deadlift",
        "Romanian Deadlift",
        "Stiff-Legged Barbell Deadlift",
        "Dumbbell Deadlift",
      ],
    ],
    [
      "lunge",
      [
        "Dumbbell Lunges",
        "Barbell Lunge",
        "Bodyweight Walking Lunge",
        "Dumbbell Rear Lunge",
      ],
    ],
  ];
  const extra = {
    "Barbell Shoulder Press": "overhead",
    "Cable Preacher Curl": "curl",
    "Dumbbell Alternate Bicep Curl": "curl",
    "Dumbbell Bench Press with Neutral Grip": "press",
    "Barbell Walking Lunge": "lunge",
  };
  return mappings.find(([, names]) => names.includes(name))?.[0] ?? extra[name];
};
function requirements(e) {
  let req = e.equipment === "body only" ? [] : [e.equipment || "body only"];
  const n = e.name.toLowerCase();
  if (
    /bench press|incline dumbbell|decline dumbbell|seated dumbbell|seated barbell|concentration curl|preacher|lying.*extension|incline.*curl/.test(
      n,
    )
  )
    req.push("bench");
  if (
    /barbell.*squat|front barbell|standing military|barbell bench|incline barbell/.test(
      n,
    )
  )
    req.push("rack");
  if (/pullup|pull-up|chin-up|chin up/.test(n)) req.push("pullup");
  if (e.equipment === "machine") {
    let specific = /smith/.test(n)
      ? "smith"
      : /hack squat/.test(n)
        ? "hack squat"
        : /leg press/.test(n)
          ? "leg press"
          : /seated leg curl/.test(n)
            ? "seated leg curl"
            : /lying leg curl/.test(n)
              ? "lying leg curl"
              : /leg curl/.test(n)
                ? "leg curl"
                : /leg extension/.test(n)
                  ? "leg extension"
                  : /chest press/.test(n)
                    ? "chest press"
                    : /butterfly|reverse machine fly/.test(n)
                      ? "pec deck"
                      : /pulldown/.test(n)
                        ? "lat pulldown"
                        : /seated.*row/.test(n)
                          ? "seated row"
                          : /assisted/.test(n)
                            ? "assisted"
                            : /calf/.test(n)
                              ? "calf machine"
                              : `machine:${e.id}`;
    req = [specific];
    if (/smith.*bench|smith.*incline|smith.*seated|smith.*decline/.test(n))
      req.push("bench");
  }
  if (/rope/.test(n) && e.equipment === "cable") req.push("rope attachment");
  if (
    /lying.*curl|incline|decline|seated.*press|dumbbell.*flyes|dumbbell.*row/.test(
      n,
    ) &&
    e.equipment === "dumbbell"
  )
    req.push("bench");
  if (e.category === "cardio") {
    req = /treadmill/.test(n)
      ? ["treadmill"]
      : /elliptical/.test(n)
        ? ["elliptical"]
        : /row/.test(n)
          ? ["rower"]
          : /bike|cycling/.test(n)
            ? ["bike"]
            : /rope/.test(n)
              ? ["jump rope"]
              : req;
  }
  return [...new Set(req.filter((x) => x !== "body only"))];
}
const exercises = source
  .filter(
    (e) =>
      ["strength", "cardio", "plyometrics", "stretching"].includes(
        e.category,
      ) &&
      !["other", null].includes(e.equipment) &&
      e.instructions.length &&
      e.images.length,
  )
  .map((e) => ({
    ...e,
    required: requirements(e),
    mode:
      e.category === "cardio"
        ? "cardio"
        : /plank|hold|stretch/.test(e.name.toLowerCase()) ||
            e.category === "stretching"
          ? "duration"
          : "strength",
    animation: animationFor(e.name),
    cues: [
      "Use a controlled tempo through the described range of motion.",
      "Choose a load that lets you maintain the setup and technique.",
    ],
    mistakes: [
      "Using momentum to move a load you cannot control.",
      "Losing the setup or rushing the return portion of the movement.",
    ],
  }));
fs.mkdirSync("src/data", { recursive: true });
fs.mkdirSync("public/exercises", { recursive: true });
fs.writeFileSync("src/data/exercises.json", JSON.stringify(exercises));
fs.writeFileSync(
  "public/exercise-sources.json",
  JSON.stringify(
    {
      source: "https://github.com/yuhonas/free-exercise-db",
      licence: "Unlicense",
      count: exercises.length,
      animations: exercises.filter((e) => e.animation).length,
    },
    null,
    2,
  ),
);
console.log(
  `${exercises.length} exercises; ${exercises.filter((e) => e.animation).length} animations`,
);
