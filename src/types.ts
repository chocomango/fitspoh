export type Equipment = {
  id: string;
  name: string;
  listed?: boolean;
  confirmed: boolean;
  unavailable: boolean;
};
export type Exercise = {
  id: string;
  name: string;
  primaryMuscles: string[];
  secondaryMuscles: string[];
  equipment: string;
  required: string[];
  level: string;
  category: string;
  instructions: string[];
  images: string[];
  mode: "strength" | "duration" | "cardio";
  animation?: string;
  cues: string[];
  mistakes: string[];
};
export type SetLog = {
  id: string;
  weight: number;
  reps: number;
  seconds: number;
  distance: number;
  type: "working" | "warmup" | "drop" | "failure";
  effort?: number;
  effortKind?: "RIR" | "RPE";
  done: boolean;
  skipped?: boolean;
};
export type Movement = {
  id: string;
  exerciseId: string;
  sets: SetLog[];
  rest: number;
  notes: string;
  superset: string;
  repMin: number;
  repMax: number;
};
export type Day = { id: string; name: string; movements: Movement[] };
export type Plan = { id: string; name: string; days: Day[]; next: number };
export type Workout = {
  id: string;
  name: string;
  started: string;
  finished?: string;
  movements: Movement[];
  notes: string;
  planId?: string;
  dayId?: string;
  guided?: {
    setId?: string;
    phase: "intro" | "entry" | "rest" | "between" | "summary";
    lastSetId?: string;
    overview?: boolean;
    draft?: {
      setId: string;
      values: Partial<
        Record<"weight" | "reps" | "seconds" | "distance" | "effort", string>
      >;
    };
  };
};
export type BodyEntry = {
  id: string;
  date: string;
  weight?: number;
  fat?: number;
  waist?: number;
  chest?: number;
  hips?: number;
  arm?: number;
  thigh?: number;
  notes: string;
};
export type State = {
  version: 1;
  plans: Plan[];
  workouts: Workout[];
  active: Workout | null;
  body: BodyEntry[];
  equipment: Equipment[];
  custom: Exercise[];
  favourites: string[];
  exerciseNotes: Record<string, string>;
  setupNotes: Record<string, string>;
  settings: {
    weight: "kg" | "lb";
    length: "cm" | "in";
    distance: "km" | "mi";
    effort: "off" | "RIR" | "RPE";
    theme?: "focus" | "sumikko";
    goal?: number;
    lastBackup?: string;
  };
  timer: number | null;
};
