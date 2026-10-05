import { openDB } from "idb";
import type { State, Equipment } from "./types";
import exercises from "./data/exercises.json";
const catalogue: [string, string, boolean][] = [
  ["barbell", "Barbells", true],
  ["dumbbell", "Dumbbells", true],
  ["kettlebells", "Kettlebells", true],
  ["rack", "Squat / multifunction rack", true],
  ["machine", "Strength machines (category)", true],
  ["plate machine", "Plate-loaded machines (category)", true],
  ["bands", "Resistance bands", true],
  ["medicine ball", "Medicine balls", true],
  ["exercise ball", "Exercise ball", false],
  ["foam roll", "Foam roller", false],
  ["bench", "Adjustable bench", false],
  ["cable", "Cable station", false],
  ["pullup", "Pull-up bar", false],
  ["smith", "Smith machine", false],
  ["leg press", "Leg press", false],
  ["leg curl", "Leg curl machine", false],
  ["leg extension", "Leg extension machine", false],
  ["chest press", "Chest press machine", false],
  ["pec deck", "Pec deck / reverse fly", false],
  ["lat pulldown", "Lat pulldown", false],
  ["seated row", "Seated row machine", false],
  ["assisted", "Assisted dip / pull-up machine", false],
  ["calf machine", "Calf machine", false],
  ["treadmill", "Treadmills", true],
  ["bike", "Exercise cycles", true],
  ["elliptical", "Ellipticals", true],
  ["rower", "Rowing machines", true],
  ["spin bike", "Spin bikes", true],
  ["battle ropes", "Battle ropes", true],
  ["jump rope", "Jump ropes", true],
  ["box", "Plyometric boxes", true],
  ["trx", "TRX suspension trainer", true],
  ["bosu", "BOSU", true],
];
const equipment: Equipment[] = catalogue.map(([id, name, listed]) => ({
  id,
  name,
  listed,
  confirmed: false,
  unavailable: false,
}));
for (const id of [...new Set(exercises.flatMap((e) => e.required))])
  if (!equipment.some((e) => e.id === id)) {
    const name = id.startsWith("machine:")
      ? (exercises.find((e) => e.id === id.slice(8))?.name ?? id)
      : id;
    equipment.push({ id, name, confirmed: false, unavailable: false });
  }
export const initialState: State = {
  version: 1,
  plans: [],
  workouts: [],
  active: null,
  body: [],
  equipment,
  custom: [],
  favourites: [],
  exerciseNotes: {},
  setupNotes: {},
  settings: {
    weight: "kg",
    length: "cm",
    distance: "km",
    effort: "off",
    theme: "focus",
  },
  timer: null,
};
let database: ReturnType<typeof openDB> | undefined;
const db = () =>
  (database ??= openDB("fitspoh", 1, {
    upgrade(db) {
      db.createObjectStore("journal");
    },
  }));
export async function readState(): Promise<State> {
  return (
    (await (await db()).get("journal", "state")) ??
    structuredClone(initialState)
  );
}
export async function writeState(state: State) {
  await (await db()).put("journal", state, "state");
}
