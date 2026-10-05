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
export const journalClient = crypto.randomUUID();
export class StorageConflict extends Error {
  constructor() {
    super(
      "Another tab updated this journal. Reload before making more changes.",
    );
  }
}
export async function readJournal() {
  const tx = (await db()).transaction("journal", "readonly");
  const [stored, savedRevision] = await Promise.all([
    tx.store.get("state"),
    tx.store.get("revision"),
    tx.done,
  ]);
  const revision = savedRevision ?? 0;
  if (!Number.isSafeInteger(revision) || revision < 0)
    throw Error("Invalid journal revision.");
  return {
    state: (stored ?? structuredClone(initialState)) as State,
    revision: revision as number,
    exists: stored !== undefined,
  };
}
/** A null revision is reserved for an explicitly reviewed backup restore. */
export async function writeState(
  state: State,
  expectedRevision: number | null,
) {
  const tx = (await db()).transaction("journal", "readwrite");
  try {
    const stored = (await tx.store.get("revision")) ?? 0;
    if (expectedRevision !== null && stored !== expectedRevision) {
      tx.abort();
      await tx.done.catch(() => {});
      throw new StorageConflict();
    }
    const revision =
      (Number.isSafeInteger(stored) && stored >= 0 ? stored : 0) + 1;
    await tx.store.put(state, "state");
    await tx.store.put(revision, "revision");
    await tx.done;
    if (typeof BroadcastChannel !== "undefined") {
      try {
        const channel = new BroadcastChannel("fitspoh-journal");
        channel.postMessage({ revision, writer: journalClient });
        channel.close();
      } catch {
        /* Optimistic revision checks still protect writes without cross-tab notifications. */
      }
    }
    return revision;
  } catch (error) {
    try {
      tx.abort();
    } catch {
      /* The failed transaction may already be closed. */
    }
    await tx.done.catch(() => {});
    throw error;
  }
}
