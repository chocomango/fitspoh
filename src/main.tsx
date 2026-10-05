import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Activity,
  ArrowDown,
  ArrowRight,
  ArrowUp,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Download,
  Dumbbell,
  Heart,
  History,
  LayoutDashboard,
  Plus,
  Search,
  Settings,
  SlidersHorizontal,
  Timer,
  Trash2,
  Upload,
  X,
  Star,
  Save,
  Link,
  RotateCcw,
  Scale,
  WifiOff,
  MoreHorizontal,
} from "lucide-react";
import type {
  State,
  Exercise,
  Movement,
  Workout,
  Plan,
  Day,
  SetLog,
  BodyEntry,
} from "./types";
import { initialState, readState, writeState } from "./store";
import {
  uid,
  available,
  volume,
  rollingWeight,
  toDisplayWeight,
  toStoredWeight,
  toDisplayLength,
  toStoredLength,
  toDisplayDistance,
  toStoredDistance,
  validateBackup,
} from "./domain.mjs";
import { Chart, MovementDemo, Empty } from "./components";
import { CornerFriend, CornerFriends } from "./CornerFriends";
import exerciseData from "./data/exercises.json";
import "./style.css";
import "./polish.css";
import "./guided.css";
import { GuidedWorkout } from "./GuidedWorkout";
const library = exerciseData as Exercise[];
const NAV = [
  ["dashboard", "Overview", LayoutDashboard],
  ["workout", "Workout", Dumbbell],
  ["plans", "My plans", ClipboardList],
  ["library", "Exercises", Search],
  ["body", "Body progress", Scale],
  ["history", "History", History],
  ["equipment", "My gym", SlidersHorizontal],
  ["settings", "Settings", Settings],
] as const;
const localDate = (s = new Date()) =>
  new Date(s.getTime() - s.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
const today = () => localDate().slice(0, 10);
const fmt = (n: number) =>
  new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(n);
const dateLabel = (s: string) =>
  new Date(s).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
const setTemplate = (): SetLog => ({
  id: uid(),
  weight: 0,
  reps: 10,
  seconds: 60,
  distance: 0,
  type: "working",
  done: false,
  skipped: false,
});
const makeMovement = (e: Exercise): Movement => ({
  id: uid(),
  exerciseId: e.id,
  sets: Array.from({ length: e.mode === "cardio" ? 1 : 3 }, setTemplate),
  rest: 90,
  notes: "",
  superset: "",
  repMin: 8,
  repMax: 12,
});
function download(name: string, text: string, type = "application/json") {
  const a = document.createElement("a"),
    url = URL.createObjectURL(new Blob([text], { type }));
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function App() {
  const [state, setState] = useState<State>(initialState),
    [ready, setReady] = useState(false),
    [storageSafe, setStorageSafe] = useState(true),
    [saveStatus, setSaveStatus] = useState("Loading…"),
    [tab, setTab] = useState(location.hash.slice(1) || "dashboard");
  const [modal, setModal] = useState<React.ReactNode>(null),
    [notice, setNotice] = useState(""),
    [query, setQuery] = useState(""),
    [muscle, setMuscle] = useState("all"),
    [equipment, setEquipment] = useState("all"),
    [gymOnly, setGymOnly] = useState(false),
    [favsOnly, setFavsOnly] = useState(false),
    [showFilters, setShowFilters] = useState(false),
    [limit, setLimit] = useState(36),
    [picker, setPicker] = useState<((e: Exercise) => void) | null>(null),
    [detail, setDetail] = useState<Exercise | null>(null),
    [selectedPlan, setSelectedPlan] = useState<string | null>(null),
    [selectedDay, setSelectedDay] = useState<string | null>(null),
    [historyEdit, setHistoryEdit] = useState<string | null>(null),
    [bodyMetric, setBodyMetric] = useState("weight"),
    [now, setNow] = useState(Date.now()),
    [offline, setOffline] = useState(!navigator.onLine);
  const [bodyEdit, setBodyEdit] = useState<BodyEntry | null | undefined>(
      undefined,
    ),
    [bodyForm, setBodyForm] = useState<Record<string, string>>({}),
    [historyMonth, setHistoryMonth] = useState(today().slice(0, 7));
  const fileRef = useRef<HTMLInputElement>(null),
    saveQueue = useRef(Promise.resolve()),
    undoRef = useRef<Workout | null>(null),
    stateRef = useRef(state),
    timerAnnounced = useRef<number | null>(null),
    backupState = useRef<State | null>(null),
    saveRevision = useRef(0);
  stateRef.current = state;
  const exercises = [...library, ...state.custom];
  const cozy = state.settings.theme === "sumikko";
  const toggleTheme = () =>
    update((s) => {
      s.settings.theme = s.settings.theme === "sumikko" ? "focus" : "sumikko";
    });
  const exercise = (id: string) => exercises.find((e) => e.id === id);
  const recordedVolume = (w: Workout) => volume(w, exercise);
  const notify = (text: string) => {
    setNotice(text);
  };
  const update = (fn: (s: State) => void, undo = false) =>
    setState((old) => {
      if (undo) {
        const w = historyEdit
          ? old.workouts.find((w) => w.id === historyEdit)
          : old.active;
        undoRef.current = w ? structuredClone(w) : null;
      }
      const next = structuredClone(old);
      fn(next);
      return next;
    });
  useEffect(() => {
    readState()
      .then((s) => {
        validateBackup(
          s,
          library.map((e) => e.id),
        );
        setState(s);
        setReady(true);
      })
      .catch(() => {
        setStorageSafe(false);
        setSaveStatus(
          "Storage could not be read — existing records have not been overwritten.",
        );
        setReady(true);
      });
    const onHash = () => setTab(location.hash.slice(1) || "dashboard");
    const online = () => setOffline(!navigator.onLine);
    window.addEventListener("hashchange", onHash);
    window.addEventListener("online", online);
    window.addEventListener("offline", online);
    return () => {
      window.removeEventListener("hashchange", onHash);
      window.removeEventListener("online", online);
      window.removeEventListener("offline", online);
    };
  }, []);
  useEffect(() => {
    if (!ready || !storageSafe) return;
    const revision = ++saveRevision.current;
    setSaveStatus("Saving…");
    saveQueue.current = saveQueue.current
      .catch(() => {})
      .then(() => writeState(state))
      .then(() => {
        if (revision === saveRevision.current)
          setSaveStatus("Saved on this device");
      })
      .catch(() =>
        setSaveStatus("Save failed — export a backup before closing."),
      );
  }, [state, ready, storageSafe]);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    if (
      state.timer &&
      now >= state.timer &&
      timerAnnounced.current !== state.timer
    ) {
      timerAnnounced.current = state.timer;
      notify("Rest complete. Ready for your next set.");
      navigator.vibrate?.([150, 80, 150]);
    }
  }, [now, state.timer]);
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(""), 6000);
    return () => clearTimeout(t);
  }, [notice]);
  useEffect(() => {
    document.documentElement.dataset.theme = cozy ? "sumikko" : "focus";
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute("content", cozy ? "#faf6ee" : "#101311");
  }, [cozy]);
  useEffect(() => {
    setLimit(36);
  }, [query, muscle, equipment, gymOnly, favsOnly]);
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [selectedDay, tab]);
  useEffect(() => {
    if (!modal && !picker && !detail && bodyEdit === undefined) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const layers = document.querySelectorAll<HTMLElement>(".modal-backdrop");
    const layer = layers[layers.length - 1];
    const focusable = () =>
      Array.from(
        layer?.querySelectorAll<HTMLElement>(
          'button:not(:disabled), input:not([type="hidden"]), select, textarea, a[href]',
        ) ?? [],
      ).filter((e) => e.offsetParent !== null);
    const frame = requestAnimationFrame(() => focusable()[0]?.focus());
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        if (detail) setDetail(null);
        else if (picker) setPicker(null);
        else if (bodyEdit !== undefined) setBodyEdit(undefined);
        else setModal(null);
      }
      if (event.key === "Tab") {
        const items = focusable();
        const first = items[0],
          last = items.at(-1);
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    };
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", keydown);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("keydown", keydown);
      document.body.style.overflow = oldOverflow;
      if (previouslyFocused?.isConnected) previouslyFocused.focus();
    };
  }, [modal, picker, detail, bodyEdit]);
  const go = (name: string, historical = false) => {
    if (name === "workout" && !historical) setHistoryEdit(null);
    location.hash = name;
    setTab(name);
  };
  const launch = (
    name: string,
    movements: Movement[] = [],
    planId?: string,
    dayId?: string,
  ) => {
    setHistoryEdit(null);
    if (state.active) {
      notify("Finish or discard your current workout before starting another.");
      go("workout");
      return;
    }
    update((s) => {
      s.active = {
        id: uid(),
        name,
        started: new Date().toISOString(),
        movements: structuredClone(movements).map((m) => {
          const previous = [...s.workouts]
            .sort((a, b) => b.started.localeCompare(a.started))
            .flatMap((w) => w.movements)
            .find((x) => x.exerciseId === m.exerciseId);
          return {
            ...m,
            id: uid(),
            sets: m.sets.map((t, i) => ({
              ...t,
              weight:
                (i === 0 && previous?.sets[0]?.done
                  ? previous.sets[0].weight
                  : undefined) ?? t.weight,
              reps:
                i === 0 && previous?.sets[0]?.done
                  ? previous.sets[0].reps
                  : t.reps,
              seconds:
                i === 0 && previous?.sets[0]?.done
                  ? previous.sets[0].seconds
                  : t.seconds,
              distance:
                i === 0 && previous?.sets[0]?.done
                  ? previous.sets[0].distance
                  : t.distance,
              id: uid(),
              done: false,
              skipped: false,
            })),
          };
        }),
        notes: "",
        planId,
        dayId,
        guided: { phase: "intro", overview: !movements.length },
      };
      s.timer = null;
    });
    go("workout");
  };
  const currentPlan = state.plans.find((p) => p.id === selectedPlan),
    currentDay = currentPlan?.days.find((d) => d.id === selectedDay);
  const currentWorkout = historyEdit
    ? state.workouts.find((w) => w.id === historyEdit)
    : state.active;
  const modifyWorkout = (fn: (w: Workout) => void, undo = false) =>
    update((s) => {
      const w = historyEdit
        ? s.workouts.find((w) => w.id === historyEdit)
        : s.active;
      if (w) fn(w);
    }, undo);
  const modifyDay = (fn: (d: Day) => void) =>
    update((s) => {
      const d = s.plans
        .find((p) => p.id === selectedPlan)
        ?.days.find((d) => d.id === selectedDay);
      if (d) fn(d);
    });
  const openPicker = (callback: (e: Exercise) => void) => {
    setPicker(() => callback);
    setQuery("");
    setMuscle("all");
    setEquipment("all");
    setGymOnly(false);
    setFavsOnly(false);
  };
  const askName = (
    title: string,
    onSave: (name: string) => void,
    defaultValue = "",
  ) => {
    setModal(
      <NameForm
        title={title}
        initial={defaultValue}
        close={() => setModal(null)}
        save={(name) => {
          onSave(name);
          setModal(null);
        }}
      />,
    );
  };
  const confirm = (title: string, description: string, action: () => void) =>
    setModal(
      <div className="dialog">
        <h2>{title}</h2>
        <p>{description}</p>
        <div className="actions">
          <button className="secondary" onClick={() => setModal(null)}>
            Cancel
          </button>
          <button
            className="danger"
            onClick={() => {
              action();
              setModal(null);
            }}
          >
            Confirm
          </button>
        </div>
      </div>,
    );
  const exportBackup = () => {
    const exported = structuredClone(stateRef.current);
    exported.settings.lastBackup = new Date().toISOString();
    download(
      `fitspoh-backup-${today()}.json`,
      JSON.stringify(
        {
          format: "fitspoh-backup",
          exportedAt: new Date().toISOString(),
          data: exported,
        },
        null,
        2,
      ),
    );
    update((s) => {
      s.settings.lastBackup = exported.settings.lastBackup;
    });
    notify("Backup downloaded. Keep it somewhere safe.");
  };
  async function importFile(file: File) {
    try {
      if (file.size > 25 * 1024 * 1024)
        throw Error("Backup is too large (maximum 25 MB).");
      const s = validateBackup(
        JSON.parse(await file.text()),
        library.map((e) => e.id),
      ) as State;
      backupState.current = s;
      setModal(
        <div className="dialog">
          <span className="eyebrow">BACKUP PREVIEW</span>
          <h2>Restore your journal?</h2>
          <p>
            {s.workouts.length} workouts · {s.plans.length} plans ·{" "}
            {s.body.length} body entries
            {s.active ? " · 1 unfinished workout" : ""}
          </p>
          <p>
            This replaces the records on this device. Download your current
            backup first if you want to keep them.
          </p>
          <div className="actions">
            <button className="secondary" onClick={exportBackup}>
              <Download size={16} />
              Backup current data
            </button>
            <button
              className="danger"
              onClick={() => {
                if (backupState.current) {
                  setState(backupState.current);
                  setStorageSafe(true);
                  undoRef.current = null;
                  setModal(null);
                  setSelectedPlan(null);
                  setSelectedDay(null);
                  setHistoryEdit(null);
                  notify("Backup restored.");
                }
              }}
            >
              Replace and restore
            </button>
          </div>
        </div>,
      );
    } catch (err) {
      notify(err instanceof Error ? err.message : "Cannot read this backup.");
    }
  }
  const startBody = (entry: BodyEntry | null) => {
    setBodyEdit(entry);
    const form: Record<string, string> = {
      date: entry ? localDate(new Date(entry.date)) : localDate(),
      notes: entry?.notes ?? "",
    };
    for (const key of [
      "weight",
      "fat",
      "waist",
      "chest",
      "hips",
      "arm",
      "thigh",
    ]) {
      const n = entry?.[key as keyof BodyEntry];
      form[key] =
        typeof n === "number"
          ? String(
              Number(
                (key === "weight"
                  ? toDisplayWeight(n, state.settings.weight)
                  : key === "fat"
                    ? n
                    : toDisplayLength(n, state.settings.length)
                ).toFixed(2),
              ),
            )
          : "";
    }
    setBodyForm(form);
  };
  const completeCount = (w: Workout) =>
    w.movements.reduce((n, m) => n + m.sets.filter((s) => s.done).length, 0);
  const weekStart = new Date();
  weekStart.setHours(0, 0, 0, 0);
  weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7));
  const weekly = state.workouts.filter((w) => new Date(w.started) >= weekStart);
  const weeklyMuscles: Record<string, number> = {};
  weekly.forEach((w) =>
    w.movements.forEach((m) =>
      exercise(m.exerciseId)?.primaryMuscles.forEach((g) => {
        weeklyMuscles[g] =
          (weeklyMuscles[g] ?? 0) +
          m.sets.filter((s) => s.done && s.type !== "warmup").length;
      }),
    ),
  );
  const sortedBody = [...state.body].sort((a, b) =>
    a.date.localeCompare(b.date),
  );
  const lastWeight = sortedBody
    .filter((b) => b.weight !== undefined)
    .at(-1)?.weight;
  const personalRecords = exercises
    .flatMap((e) => {
      if (e.mode !== "strength" || /assisted/i.test(e.name)) return [];
      const sets = state.workouts.flatMap((w) =>
        w.movements
          .filter((m) => m.exerciseId === e.id)
          .flatMap((m) =>
            m.sets.filter((s) => s.done && s.type !== "warmup" && s.reps > 0),
          ),
      );
      if (!sets.length) return [];
      const bestLoad = Math.max(...sets.map((s) => s.weight));
      const bestReps = Math.max(
        ...sets.filter((s) => s.weight === bestLoad).map((s) => s.reps),
      );
      return [{ exercise: e, weight: bestLoad, reps: bestReps }];
    })
    .sort((a, b) => a.exercise.name.localeCompare(b.exercise.name));
  const visible = exercises.filter(
    (e) =>
      (!query ||
        `${e.name} ${e.primaryMuscles.join(" ")}`
          .toLowerCase()
          .includes(query.toLowerCase())) &&
      (muscle === "all" || e.primaryMuscles.includes(muscle)) &&
      (equipment === "all" || e.required.includes(equipment)) &&
      (!gymOnly || available(e, state.equipment)) &&
      (!favsOnly || state.favourites.includes(e.id)),
  );
  const renderLibrary = (selecting = false) => (
    <>
      <div className="library-tools">
        <label className="search">
          <Search size={18} />
          <input
            aria-label="Search exercises"
            placeholder="Search exercises or muscles…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <button
          className={`filter-toggle icon-button ${showFilters ? "selected" : ""}`}
          aria-label="Exercise filters"
          aria-expanded={showFilters}
          onClick={() => setShowFilters(!showFilters)}
        >
          <SlidersHorizontal size={20} />
        </button>
        <select
          className={`library-select ${showFilters ? "open" : ""}`}
          aria-label="Muscle group"
          value={muscle}
          onChange={(e) => setMuscle(e.target.value)}
        >
          <option value="all">All muscle groups</option>
          {[...new Set(exercises.flatMap((e) => e.primaryMuscles))]
            .sort()
            .map((m) => (
              <option key={m}>{m}</option>
            ))}
        </select>
        <select
          className={`library-select ${showFilters ? "open" : ""}`}
          aria-label="Equipment filter"
          value={equipment}
          onChange={(e) => setEquipment(e.target.value)}
        >
          <option value="all">All equipment</option>
          {state.equipment.map((e) => (
            <option value={e.id} key={e.id}>
              {e.name}
            </option>
          ))}
        </select>
      </div>
      <div className="filter-row">
        <button
          className={`chip ${gymOnly ? "selected" : ""}`}
          onClick={() => setGymOnly(!gymOnly)}
        >
          <SlidersHorizontal size={14} /> Available at my gym
        </button>
        <button
          className={`chip ${favsOnly ? "selected" : ""}`}
          onClick={() => setFavsOnly(!favsOnly)}
        >
          <Star size={14} /> Favourites
        </button>
        <span className="muted">{visible.length} exercises</span>
        {!selecting && (
          <button
            className="ghost ml-auto"
            onClick={() =>
              setModal(
                <CustomExerciseForm
                  equipment={state.equipment.map((e) => ({
                    id: e.id,
                    name: e.name,
                  }))}
                  close={() => setModal(null)}
                  save={(e) => {
                    update((s) => s.custom.push(e));
                    setModal(null);
                    notify("Custom exercise added.");
                  }}
                />,
              )
            }
          >
            <Plus size={16} />
            Custom exercise
          </button>
        )}
      </div>
      {gymOnly && (
        <p className="hint">
          Only confirmed, available equipment is used. Confirm your gym
          inventory in My gym.
        </p>
      )}
      <div className="exercise-grid">
        {visible.slice(0, limit).map((e) => (
          <article className="exercise-card" key={e.id}>
            <button className="exercise-image" onClick={() => setDetail(e)}>
              <ExerciseImage exercise={e} />
              <span className="image-tag">
                {e.animation ? "Movement demo" : e.category}
              </span>
            </button>
            <div className="exercise-card-body">
              <div className="row">
                <h3>
                  <button className="text-button" onClick={() => setDetail(e)}>
                    {e.name}
                  </button>
                </h3>
                <button
                  aria-label={`Favourite ${e.name}`}
                  className={`icon-button ${state.favourites.includes(e.id) ? "favourite" : ""}`}
                  onClick={() =>
                    update((s) => {
                      s.favourites = s.favourites.includes(e.id)
                        ? s.favourites.filter((id) => id !== e.id)
                        : [...s.favourites, e.id];
                    })
                  }
                >
                  <Star size={16} />
                </button>
              </div>
              <p>
                {e.primaryMuscles.join(" · ")}{" "}
                <span>
                  {" "}
                  / {e.equipment === "body only" ? "Bodyweight" : e.equipment}
                </span>
              </p>
              {selecting && (
                <button
                  className="secondary full"
                  onClick={() => {
                    picker?.(e);
                    setPicker(null);
                  }}
                >
                  <Plus size={14} />
                  Add exercise
                </button>
              )}
            </div>
          </article>
        ))}
      </div>
      {!visible.length && (
        <Empty
          title="No matching exercises"
          description="Try another filter, or confirm more equipment in your gym profile."
        />
      )}
      {visible.length > limit && (
        <button
          className="secondary centered"
          onClick={() => setLimit(limit + 36)}
        >
          Show more exercises
        </button>
      )}
    </>
  );
  const renderMovements = (
    movements: Movement[],
    edit: (fn: (m: Movement[]) => void, undo?: boolean) => void,
    isPlan = false,
  ) =>
    movements.map((m, index) => {
      const e = exercise(m.exerciseId);
      if (!e) return null;
      const last = state.workouts
        .filter(
          (w) =>
            w.id !== currentWorkout?.id &&
            w.movements.some((x) => x.exerciseId === m.exerciseId),
        )
        .sort((a, b) => b.started.localeCompare(a.started))[0]
        ?.movements.find((x) => x.exerciseId === m.exerciseId);
      return (
        <article className="movement-card" key={m.id}>
          {m.sets.some((t) => t.skipped) && (
            <p className="tag">
              Skipped sets: {m.sets.filter((t) => t.skipped && !t.done).length}
            </p>
          )}
          <div className="movement-head">
            <button className="movement-thumb" onClick={() => setDetail(e)}>
              <ExerciseImage exercise={e} />
            </button>
            <div className="grow">
              <span className="eyebrow">
                {String(index + 1).padStart(2, "0")} /{" "}
                {e.primaryMuscles.join(", ")}
              </span>
              <h3>
                <button className="text-button" onClick={() => setDetail(e)}>
                  {e.name}
                </button>
              </h3>
              <p className="muted">
                {e.required
                  .map(
                    (id) =>
                      state.equipment.find((eq) => eq.id === id)?.name ?? id,
                  )
                  .join(" + ") || "Bodyweight"}{" "}
                ·{" "}
                {e.mode === "strength"
                  ? /dumbbell/i.test(e.equipment)
                    ? `Weight per hand (${state.settings.weight})`
                    : /assisted/i.test(e.name)
                      ? `Assistance (${state.settings.weight})`
                      : `Total load (${state.settings.weight})`
                  : e.mode === "cardio"
                    ? "Time and distance"
                    : "Duration"}
              </p>
            </div>
            <div className="movement-actions">
              {!isPlan && !historyEdit && (
                <>
                  <button
                    className="secondary"
                    onClick={() =>
                      modifyWorkout((w) => {
                        m.sets.forEach((t) => {
                          const target = w.movements
                            .flatMap((x) => x.sets)
                            .find((x) => x.id === t.id);
                          if (target && !target.done) target.skipped = true;
                        });
                      })
                    }
                  >
                    Skip exercise
                  </button>
                  <button
                    className="secondary"
                    onClick={() =>
                      modifyWorkout((w) => {
                        const target = w.movements.find((x) => x.id === m.id);
                        target?.sets.forEach((t) => {
                          if (!t.done) t.skipped = false;
                        });
                        w.guided = {
                          setId: target?.sets.find((t) => !t.done)?.id,
                          phase: "intro",
                          overview: false,
                        };
                      })
                    }
                  >
                    Guide this exercise
                  </button>
                </>
              )}
              <button
                className="icon-button"
                disabled={index === 0}
                aria-label="Move exercise up"
                onClick={() =>
                  edit((ms) => {
                    [ms[index - 1], ms[index]] = [ms[index], ms[index - 1]];
                  })
                }
              >
                <ArrowUp size={16} />
              </button>
              <button
                className="icon-button"
                disabled={index === movements.length - 1}
                aria-label="Move exercise down"
                onClick={() =>
                  edit((ms) => {
                    [ms[index + 1], ms[index]] = [ms[index], ms[index + 1]];
                  })
                }
              >
                <ArrowDown size={16} />
              </button>
              <button
                className="icon-button"
                aria-label="Replace exercise"
                onClick={() => {
                  openPicker((replacement) =>
                    edit((ms) => {
                      ms[index] = makeMovement(replacement);
                    }),
                  );
                  setMuscle(e.primaryMuscles[0] ?? "all");
                  setGymOnly(true);
                }}
              >
                <RotateCcw size={16} />
              </button>
              <button
                className="icon-button"
                aria-label="Remove exercise"
                onClick={() =>
                  edit((ms) => {
                    ms.splice(index, 1);
                  }, true)
                }
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>
          <div
            className={`set-table ${state.settings.effort !== "off" ? "has-effort" : ""}`}
          >
            <div className="set-row table-head">
              <span>SET</span>
              <span>{isPlan ? "TYPE" : "PREVIOUS"}</span>
              {e.mode === "strength" ? (
                <>
                  <span>{state.settings.weight.toUpperCase()}</span>
                  <span>REPS</span>
                </>
              ) : (
                <>
                  <span>MIN : SEC</span>
                  <span>
                    {e.mode === "cardio"
                      ? state.settings.distance.toUpperCase()
                      : "—"}
                  </span>
                </>
              )}
              {state.settings.effort !== "off" && (
                <span>{state.settings.effort}</span>
              )}
              <span>{isPlan ? "REMOVE" : "DONE"}</span>
            </div>
            {m.sets.map((s, i) => {
              const previous = last?.sets[i];
              return (
                <div
                  className={`set-row ${s.done && !isPlan ? "set-done" : ""}`}
                  key={s.id}
                >
                  <select
                    aria-label={`Set ${i + 1} type`}
                    value={s.type}
                    onChange={(ev) =>
                      edit((ms) => {
                        ms[index].sets[i].type = ev.target
                          .value as SetLog["type"];
                      })
                    }
                  >
                    {["working", "warmup", "drop", "failure"].map((type) => (
                      <option value={type} key={type}>
                        {type === "working"
                          ? String(i + 1)
                          : type === "warmup"
                            ? "W"
                            : type === "drop"
                              ? "D"
                              : "F"}
                      </option>
                    ))}
                  </select>
                  <button
                    className="previous previous-copy"
                    disabled={isPlan || !previous}
                    title={isPlan ? "Set type" : "Copy this previous set"}
                    onClick={() => {
                      if (previous && !isPlan)
                        edit((ms) => {
                          ms[index].sets[i] = {
                            ...previous,
                            id: s.id,
                            done: false,
                            skipped: false,
                          };
                        });
                    }}
                  >
                    {isPlan
                      ? s.type
                      : previous
                        ? e.mode === "strength"
                          ? `${fmt(toDisplayWeight(previous.weight, state.settings.weight))} × ${previous.reps}`
                          : `${Math.floor(previous.seconds / 60)}:${String(previous.seconds % 60).padStart(2, "0")}`
                        : "—"}
                  </button>
                  {e.mode === "strength" ? (
                    <>
                      <NumberInput
                        label={`Set ${i + 1} weight`}
                        value={toDisplayWeight(s.weight, state.settings.weight)}
                        step={0.5}
                        onChange={(v) =>
                          edit((ms) => {
                            ms[index].sets[i].weight = toStoredWeight(
                              v,
                              state.settings.weight,
                            );
                          })
                        }
                      />
                      <NumberInput
                        label={`Set ${i + 1} reps`}
                        value={s.reps}
                        step={1}
                        onChange={(v) =>
                          edit((ms) => {
                            ms[index].sets[i].reps = Math.round(v);
                          })
                        }
                      />
                    </>
                  ) : (
                    <>
                      <DurationInput
                        seconds={s.seconds}
                        onChange={(v) =>
                          edit((ms) => {
                            ms[index].sets[i].seconds = v;
                          })
                        }
                      />
                      {e.mode === "cardio" ? (
                        <NumberInput
                          label={`Set ${i + 1} distance`}
                          value={toDisplayDistance(
                            s.distance,
                            state.settings.distance,
                          )}
                          step={0.1}
                          onChange={(v) =>
                            edit((ms) => {
                              ms[index].sets[i].distance = toStoredDistance(
                                v,
                                state.settings.distance,
                              );
                            })
                          }
                        />
                      ) : (
                        <span>—</span>
                      )}
                    </>
                  )}
                  {state.settings.effort !== "off" && (
                    <input
                      className="number"
                      aria-label={`Set ${i + 1} effort`}
                      type="number"
                      min="0"
                      max="10"
                      step=".5"
                      placeholder="—"
                      value={
                        s.effortKind && s.effortKind !== state.settings.effort
                          ? ""
                          : (s.effort ?? "")
                      }
                      onChange={(ev) =>
                        edit((ms) => {
                          ms[index].sets[i].effortKind = state.settings
                            .effort as "RIR" | "RPE";
                          ms[index].sets[i].effort =
                            ev.target.value === ""
                              ? undefined
                              : Math.max(
                                  0,
                                  Math.min(10, Number(ev.target.value)),
                                );
                        })
                      }
                    />
                  )}
                  <button
                    className={`set-check ${s.done ? "checked" : ""}`}
                    aria-pressed={isPlan ? undefined : s.done}
                    aria-label={
                      isPlan ? `Remove set ${i + 1}` : `Complete set ${i + 1}`
                    }
                    onClick={() => {
                      if (isPlan)
                        edit((ms) => {
                          ms[index].sets.splice(i, 1);
                        });
                      else {
                        edit((ms) => {
                          ms[index].sets[i].done = !s.done;
                          ms[index].sets[i].skipped = false;
                        }, true);
                        if (
                          !s.done &&
                          !historyEdit &&
                          s.type !== "warmup" &&
                          e.mode === "strength" &&
                          !/assisted/i.test(e.name)
                        ) {
                          const record = personalRecords.find(
                            (r) => r.exercise.id === e.id,
                          );
                          if (
                            record &&
                            (s.weight > record.weight ||
                              (s.weight === record.weight &&
                                s.reps > record.reps))
                          )
                            notify(
                              `New personal record: ${e.name}, ${fmt(toDisplayWeight(s.weight, state.settings.weight))} ${state.settings.weight} × ${s.reps}!`,
                            );
                        }
                        if (!s.done && m.rest && !historyEdit) {
                          const group = m.superset
                            ? movements.filter((x) => x.superset === m.superset)
                            : [];
                          const roundDone =
                            !group.length ||
                            group.every(
                              (x) =>
                                x.id === m.id || !x.sets[i] || x.sets[i].done,
                            );
                          if (roundDone)
                            update((st) => {
                              st.timer = Date.now() + m.rest * 1000;
                            });
                        }
                      }
                    }}
                  >
                    {isPlan ? <X size={16} /> : <Check size={17} />}
                  </button>
                </div>
              );
            })}
          </div>
          <div className="movement-options">
            <button
              className="ghost"
              onClick={() =>
                edit((ms) => {
                  const prev = ms[index].sets.at(-1);
                  ms[index].sets.push(
                    prev ? { ...prev, id: uid(), done: false } : setTemplate(),
                  );
                })
              }
            >
              <Plus size={15} />
              Add set
            </button>
            {!isPlan && last && (
              <button
                className="ghost"
                onClick={() =>
                  edit((ms) => {
                    ms[index].sets = last.sets.map((s) => ({
                      ...s,
                      id: uid(),
                      done: false,
                      skipped: false,
                    }));
                  })
                }
              >
                <History size={14} />
                Copy last workout
              </button>
            )}
            <label className="inline-label">
              <Timer size={14} />
              <input
                aria-label="Rest seconds"
                type="number"
                min="0"
                max="3600"
                value={m.rest}
                onChange={(ev) =>
                  edit((ms) => {
                    ms[index].rest = Math.max(
                      0,
                      Math.min(3600, Number(ev.target.value)),
                    );
                  })
                }
              />{" "}
              sec rest
            </label>
            <label className="inline-label">
              <Link size={14} />
              Group
              <select
                aria-label="Superset or circuit group"
                value={m.superset}
                onChange={(ev) =>
                  edit((ms) => {
                    ms[index].superset = ev.target.value;
                  })
                }
              >
                <option value="">None</option>
                <option value="A">A</option>
                <option value="B">B</option>
                <option value="C">C</option>
              </select>
            </label>
          </div>
          {isPlan && e.mode === "strength" && (
            <div className="target-row">
              <span>Target rep range</span>
              <NumberInput
                label="Minimum target reps"
                value={m.repMin}
                step={1}
                onChange={(v) =>
                  edit((ms) => {
                    ms[index].repMin = Math.round(v);
                    ms[index].repMax = Math.max(
                      ms[index].repMax,
                      Math.round(v),
                    );
                  })
                }
              />
              <span>to</span>
              <NumberInput
                label="Maximum target reps"
                value={m.repMax}
                step={1}
                onChange={(v) =>
                  edit((ms) => {
                    ms[index].repMax = Math.max(
                      ms[index].repMin,
                      Math.round(v),
                    );
                  })
                }
              />
            </div>
          )}
          {!isPlan && e.mode === "strength" && (
            <p className="hint">
              Target: {m.repMin}–{m.repMax} reps{" "}
              {m.superset
                ? `· Superset/circuit ${m.superset}: rest after completing the round.`
                : ""}
            </p>
          )}
          <input
            className="movement-note"
            aria-label="Exercise session notes"
            placeholder={
              isPlan ? "Plan notes, tempo, or cues…" : "Session notes…"
            }
            value={m.notes}
            onChange={(ev) =>
              edit((ms) => {
                ms[index].notes = ev.target.value;
              })
            }
          />
          {state.setupNotes[e.id] && (
            <p className="setup-note">Gym setup: {state.setupNotes[e.id]}</p>
          )}
        </article>
      );
    });
  const finishWorkout = () => {
    if (!state.active) return;
    if (!completeCount(state.active)) {
      notify("Complete at least one set before finishing.");
      return;
    }
    confirm(
      "Finish this workout?",
      "Completed sets will be saved to history. Uncompleted sets stay visible but do not count towards progress.",
      () => {
        update((s) => {
          const w = s.active!;
          w.finished = new Date().toISOString();
          s.workouts.push(w);
          if (w.planId) {
            const p = s.plans.find((p) => p.id === w.planId);
            if (p) {
              const i = p.days.findIndex((d) => d.id === w.dayId);
              if (i >= 0) p.next = (i + 1) % Math.max(p.days.length, 1);
            }
          }
          s.active = null;
          s.timer = null;
        });
        go("history");
        notify("Workout saved. Nice work showing up.");
      },
    );
  };
  const csvExport = () => {
    const escape = (v: unknown) => `"${String(v ?? "").replaceAll('"', '""')}"`;
    const rows = [
      [
        "Date",
        "Workout",
        "Exercise",
        "Set type",
        "Completed",
        "Weight (kg)",
        "Reps",
        "Duration (sec)",
        "Distance (km)",
        "Effort",
        "Notes",
      ],
      ...state.workouts.flatMap((w) =>
        w.movements.flatMap((m) =>
          m.sets.map((s) => [
            w.started,
            w.name,
            exercise(m.exerciseId)?.name,
            s.type,
            s.done,
            s.weight,
            s.reps,
            s.seconds,
            s.distance,
            s.effort,
            m.notes,
          ]),
        ),
      ),
    ];
    download(
      `fitspoh-workouts-${today()}.csv`,
      rows.map((r) => r.map(escape).join(",")).join("\r\n"),
      "text/csv",
    );
    const body = [
      [
        "Date",
        "Weight (kg)",
        "Body fat (%)",
        "Waist (cm)",
        "Chest (cm)",
        "Hips (cm)",
        "Arm (cm)",
        "Thigh (cm)",
        "Notes",
      ],
      ...state.body.map((b) => [
        b.date,
        b.weight,
        b.fat,
        b.waist,
        b.chest,
        b.hips,
        b.arm,
        b.thigh,
        b.notes,
      ]),
    ];
    download(
      `fitspoh-body-${today()}.csv`,
      body.map((r) => r.map(escape).join(",")).join("\r\n"),
      "text/csv",
    );
  };
  if (!ready)
    return (
      <div className="empty">
        <h2>Opening your journal…</h2>
        <p>Loading records saved on this device.</p>
      </div>
    );
  return (
    <div className="app-shell">
      <aside
        className="sidebar"
        inert={!!modal || !!picker || !!detail || bodyEdit !== undefined}
      >
        <a className="brand" href="#dashboard">
          <div className="brand-icon">
            <Activity size={25} />
          </div>
          fitspoh<span className="brand-dot">.</span>
        </a>
        <div className="sidebar-section">YOUR TRAINING SPACE</div>
        <nav>
          {NAV.map(([key, label, Icon]) => (
            <a
              key={key}
              href={`#${key}`}
              onClick={() => {
                if (key === "workout") setHistoryEdit(null);
              }}
              className={tab === key ? "active" : ""}
            >
              <Icon size={19} />
              <span>{label}</span>
              {key === "workout" && state.active && <i className="live-dot" />}
            </a>
          ))}
        </nav>
        <div className="gym-badge">
          <div className="gym-badge-icon">
            <Dumbbell size={20} />
          </div>
          <strong>Anytime Fitness</strong>
          <span>Bedok South CC</span>
          <a href="#equipment">
            Manage equipment <ArrowRight size={13} />
          </a>
        </div>
        <div className="storage-status">
          <i
            className={
              saveStatus.includes("Saved") ? "saved-dot" : "warning-dot"
            }
          />
          {saveStatus}
        </div>
      </aside>
      <main inert={!!modal || !!picker || !!detail || bodyEdit !== undefined}>
        <header className="topbar">
          <span>PERSONAL TRAINING JOURNAL</span>
          <a className="mobile-brand" href="#dashboard">
            <Activity size={21} />
            fitspoh<span>.</span>
          </a>
          <div>
            <span className="date-pill">
              <CalendarDays size={14} />
              {new Date().toLocaleDateString(undefined, {
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
            </span>
            <button
              className="theme-toggle"
              role="switch"
              aria-checked={cozy}
              aria-label="Sumikko Gurashi theme"
              onClick={toggleTheme}
            >
              <CornerFriend kind="bear" />
              <span>{cozy ? "Sumikko" : "Focus"}</span>
              <span className="switch-track">
                <i />
              </span>
            </button>
          </div>
        </header>
        {offline && (
          <div className="offline-banner">
            <WifiOff size={14} />
            Offline mode · your changes save on this device.
          </div>
        )}
        <div
          className={`page ${tab === "dashboard" ? "home-page" : ""} ${tab === "workout" && currentWorkout ? "live-workout-page" : ""}`}
        >
          <div className="page-heading">
            <div>
              <span className="eyebrow">
                {tab === "dashboard"
                  ? "BUILD A LITTLE BETTER, EVERY DAY"
                  : "YOUR PERSONAL TRAINING SPACE"}
              </span>
              <h1>
                {tab === "dashboard"
                  ? cozy
                    ? "A little stronger, together."
                    : "Your training, in focus."
                  : (NAV.find((n) => n[0] === tab)?.[1] ?? "Overview")}
              </h1>
              <p>
                {
                  (
                    {
                      dashboard:
                        "Every rep is a step forward. Make this one count.",
                      workout: "Focus on your next set. We’ll keep the record.",
                      plans: "Build it once. Show up and follow your plan.",
                      library: "Find your movement. Learn it. Make it yours.",
                      body: "A bigger picture of your progress, one entry at a time.",
                      history: "Look back at the work you’ve put in.",
                      equipment: "Your equipment. Your exercise possibilities.",
                      settings: "Make this training space your own.",
                    } as Record<string, string>
                  )[tab]
                }
              </p>
            </div>
            {tab === "dashboard" && (
              <button
                className="primary"
                onClick={() =>
                  state.active ? go("workout") : launch("My workout")
                }
              >
                <Plus size={18} />
                {state.active ? "Resume workout" : "Start workout"}
              </button>
            )}
            {tab === "body" && (
              <button className="primary" onClick={() => startBody(null)}>
                <Plus size={18} />
                Log body stats
              </button>
            )}
            {tab === "plans" && (
              <button
                className="primary"
                onClick={() =>
                  askName("Create a training plan", (name) => {
                    const p: Plan = { id: uid(), name, days: [], next: 0 };
                    update((s) => s.plans.push(p));
                    setSelectedPlan(p.id);
                  })
                }
              >
                <Plus size={18} />
                New plan
              </button>
            )}
          </div>
          {tab === "dashboard" && (
            <>
              {cozy && (
                <section className="cozy-welcome">
                  <div>
                    <span className="eyebrow">YOUR COZY TRAINING CORNER</span>
                    <p>
                      One set at a time.
                      <br />
                      The little things add up.
                    </p>
                  </div>
                  <CornerFriends />
                </section>
              )}
              <div className="stats-grid">
                <Stat
                  label="WORKOUTS THIS WEEK"
                  value={String(weekly.length)}
                  unit="sessions"
                  detail={`${state.workouts.length} total workouts`}
                  icon={<Dumbbell size={19} />}
                />
                <Stat
                  label="WEEKLY VOLUME"
                  value={fmt(
                    toDisplayWeight(
                      weekly.reduce((s, w) => s + recordedVolume(w), 0),
                      state.settings.weight,
                    ),
                  )}
                  unit={state.settings.weight}
                  detail="Recorded load × reps · warmups excluded"
                  icon={<Activity size={19} />}
                />
                <Stat
                  label="LATEST BODYWEIGHT"
                  value={
                    lastWeight === undefined
                      ? "—"
                      : fmt(toDisplayWeight(lastWeight, state.settings.weight))
                  }
                  unit={state.settings.weight}
                  detail={
                    lastWeight === undefined
                      ? "Log your first weigh-in"
                      : "Your latest recorded measurement"
                  }
                  icon={<Scale size={19} />}
                />
                <Stat
                  label="YOUR EXERCISE LIBRARY"
                  value={String(exercises.length)}
                  unit="exercises"
                  detail={`${exercises.filter((e) => e.animation).length} movement demonstrations`}
                  icon={<ClipboardList size={19} />}
                />
              </div>
              <div className="dashboard-grid">
                <section className="panel next-workout">
                  <div className="section-title">
                    <h2>Up next</h2>
                    <a href="#plans">
                      View plans <ArrowRight size={14} />
                    </a>
                  </div>
                  {state.active ? (
                    <>
                      <span className="tag green">IN PROGRESS</span>
                      <h3 className="hero-title">{state.active.name}</h3>
                      <p>
                        {completeCount(state.active)} completed sets · started{" "}
                        {dateLabel(state.active.started)}
                      </p>
                      <button className="primary" onClick={() => go("workout")}>
                        Continue workout <ArrowRight size={16} />
                      </button>
                    </>
                  ) : state.plans.some((p) => p.days.length) ? (
                    (() => {
                      const p = state.plans.find((p) => p.days.length)!;
                      const d = p.days[p.next % p.days.length];
                      return (
                        <>
                          <span className="tag green">{p.name}</span>
                          <h3 className="hero-title">{d.name}</h3>
                          <p>
                            {d.movements.length} exercises ·{" "}
                            {d.movements.reduce((n, m) => n + m.sets.length, 0)}{" "}
                            planned sets
                          </p>
                          <div className="next-exercises">
                            {d.movements.slice(0, 3).map((m) => (
                              <span key={m.id}>
                                {exercise(m.exerciseId)?.name}
                              </span>
                            ))}
                          </div>
                          <button
                            className="primary"
                            disabled={!d.movements.length}
                            onClick={() =>
                              launch(d.name, d.movements, p.id, d.id)
                            }
                          >
                            Start this workout <ArrowRight size={16} />
                          </button>
                        </>
                      );
                    })()
                  ) : (
                    <>
                      <span className="tag green">A FRESH START</span>
                      <h3 className="hero-title">Make room for progress.</h3>
                      <p>
                        Create a plan with the exercises you enjoy. Your next
                        workout will be ready when you are.
                      </p>
                      <button className="primary" onClick={() => go("plans")}>
                        Build my first plan <ArrowRight size={16} />
                      </button>
                      <div className="decorative-lines">
                        <i />
                        <i />
                        <i />
                        <i />
                        <i />
                      </div>
                    </>
                  )}
                </section>
                <section className="panel">
                  <div className="section-title">
                    <h2>Bodyweight trend</h2>
                    <a href="#body">
                      View progress <ArrowRight size={14} />
                    </a>
                  </div>
                  <Chart
                    points={rollingWeight(state.body).map(
                      (p: { date: string; value: number }) => ({
                        ...p,
                        value: toDisplayWeight(p.value, state.settings.weight),
                      }),
                    )}
                    goal={
                      state.settings.goal === undefined
                        ? undefined
                        : toDisplayWeight(
                            state.settings.goal,
                            state.settings.weight,
                          )
                    }
                    label={state.settings.weight}
                  />
                  <p className="hint">
                    Seven-day rolling average · only recorded weigh-ins
                  </p>
                </section>
                <section className="panel">
                  <div className="section-title">
                    <h2>Training balance</h2>
                    <span className="muted">This week</span>
                  </div>
                  {Object.keys(weeklyMuscles).length ? (
                    Object.entries(weeklyMuscles)
                      .sort((a, b) => b[1] - a[1])
                      .map(([name, count]) => (
                        <div className="muscle-row" key={name}>
                          <span>{name}</span>
                          <div>
                            <i
                              style={{
                                width: `${(count / Math.max(...Object.values(weeklyMuscles))) * 100}%`,
                              }}
                            />
                          </div>
                          <strong>{count} sets</strong>
                        </div>
                      ))
                  ) : (
                    <Empty
                      title="Your week starts here"
                      description="Completed working sets will show your activity by primary muscle group."
                    />
                  )}
                  <p className="hint">
                    Activity counts, not a recovery estimate. A set may target
                    multiple primary muscles.
                  </p>
                </section>
                <section className="panel">
                  <div className="section-title">
                    <h2>Recent workouts</h2>
                    <a href="#history">
                      View all <ArrowRight size={14} />
                    </a>
                  </div>
                  {state.workouts.length ? (
                    [...state.workouts]
                      .sort((a, b) => b.started.localeCompare(a.started))
                      .slice(0, 3)
                      .map((w) => (
                        <button
                          className="recent-workout"
                          key={w.id}
                          onClick={() => {
                            setHistoryEdit(w.id);
                            go("workout", true);
                          }}
                        >
                          <div className="workout-icon">
                            <Dumbbell size={19} />
                          </div>
                          <div className="grow">
                            <strong>{w.name}</strong>
                            <span>
                              {dateLabel(w.started)} · {completeCount(w)} sets
                            </span>
                          </div>
                          <ChevronRight size={17} />
                        </button>
                      ))
                  ) : (
                    <Empty
                      title="Every session counts"
                      description="Finish your first workout to start your training history."
                    />
                  )}
                </section>
              </div>
              {(!state.settings.lastBackup ||
                now - Date.parse(state.settings.lastBackup) > 7 * 86400000) && (
                <div className="backup-reminder">
                  <Download size={18} />
                  <div>
                    <strong>Keep your progress safe.</strong>
                    <p>
                      {state.settings.lastBackup
                        ? "It has been over a week since your last export."
                        : "Your journal is saved on this device. Export a backup for recovery."}
                    </p>
                  </div>
                  <button className="secondary" onClick={exportBackup}>
                    Export backup
                  </button>
                </div>
              )}
              <div className="tip-bar">
                <Heart size={20} />
                <div>
                  <strong>Consistency over perfection.</strong>
                  <span>
                    A small session still counts. Your journal is here for every
                    kind of day.
                  </span>
                </div>
                <a href="#library">
                  Explore exercises <ArrowRight size={14} />
                </a>
              </div>
            </>
          )}
          {tab === "library" && renderLibrary()}
          {tab === "plans" && (
            <>
              {!state.plans.length ? (
                <Empty
                  title="A plan you’ll come back to"
                  description="Create a multi-day plan, add your exercises, and start each day without rebuilding your workout."
                  action={
                    <button
                      className="primary"
                      onClick={() =>
                        askName("Create a training plan", (name) => {
                          const p: Plan = {
                            id: uid(),
                            name,
                            days: [],
                            next: 0,
                          };
                          update((s) => s.plans.push(p));
                          setSelectedPlan(p.id);
                        })
                      }
                    >
                      <Plus size={16} />
                      Create first plan
                    </button>
                  }
                />
              ) : (
                <>
                  {!currentDay && (
                    <div className="plan-tabs">
                      {state.plans.map((p) => (
                        <button
                          key={p.id}
                          className={`chip ${selectedPlan === p.id ? "selected" : ""}`}
                          onClick={() => {
                            setSelectedPlan(p.id);
                            setSelectedDay(null);
                          }}
                        >
                          {p.name}
                          <span>{p.days.length} days</span>
                        </button>
                      ))}
                    </div>
                  )}
                  {currentPlan ? (
                    <>
                      {!currentDay && (
                        <>
                          <div className="section-title">
                            <h2>{currentPlan.name}</h2>
                            <div className="actions">
                              <button
                                className="ghost"
                                onClick={() =>
                                  askName(
                                    "Rename plan",
                                    (name) =>
                                      update((s) => {
                                        s.plans.find(
                                          (p) => p.id === currentPlan.id,
                                        )!.name = name;
                                      }),
                                    currentPlan.name,
                                  )
                                }
                              >
                                Rename
                              </button>
                              <button
                                className="ghost"
                                onClick={() =>
                                  update((s) => {
                                    const p = structuredClone(currentPlan);
                                    p.id = uid();
                                    p.name += " (copy)";
                                    p.days = p.days.map((d) => ({
                                      ...d,
                                      id: uid(),
                                      movements: d.movements.map((m) => ({
                                        ...m,
                                        id: uid(),
                                        sets: m.sets.map((t) => ({
                                          ...t,
                                          id: uid(),
                                        })),
                                      })),
                                    }));
                                    s.plans.push(p);
                                  })
                                }
                              >
                                Duplicate
                              </button>
                              <button
                                className="ghost"
                                onClick={() =>
                                  confirm(
                                    "Delete this plan?",
                                    "Your completed workouts will stay in history.",
                                    () => {
                                      update((s) => {
                                        s.plans = s.plans.filter(
                                          (p) => p.id !== currentPlan.id,
                                        );
                                      });
                                      setSelectedPlan(null);
                                      setSelectedDay(null);
                                    },
                                  )
                                }
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </div>
                          <div className="day-grid">
                            {currentPlan.days.map((d, i) => (
                              <article
                                className={`day-card ${selectedDay === d.id ? "chosen" : ""}`}
                                key={d.id}
                              >
                                <span className="eyebrow">
                                  DAY {i + 1}{" "}
                                  {currentPlan.next %
                                    currentPlan.days.length ===
                                  i
                                    ? "· UP NEXT"
                                    : ""}
                                </span>
                                <h3>{d.name}</h3>
                                <p>
                                  {d.movements.length} exercises ·{" "}
                                  {d.movements.reduce(
                                    (n, m) => n + m.sets.length,
                                    0,
                                  )}{" "}
                                  sets
                                </p>
                                <div className="actions">
                                  <button
                                    className="secondary"
                                    onClick={() => setSelectedDay(d.id)}
                                  >
                                    Edit day
                                  </button>
                                  <button
                                    className="primary"
                                    disabled={!d.movements.length}
                                    onClick={() =>
                                      launch(
                                        d.name,
                                        d.movements,
                                        currentPlan.id,
                                        d.id,
                                      )
                                    }
                                  >
                                    <PlayIcon />
                                    Start
                                  </button>
                                  <button
                                    className="icon-button"
                                    title="Set as next workout"
                                    onClick={() =>
                                      update((s) => {
                                        s.plans.find(
                                          (p) => p.id === currentPlan.id,
                                        )!.next = i;
                                      })
                                    }
                                  >
                                    <ArrowRight size={15} />
                                  </button>
                                </div>
                              </article>
                            ))}
                            <button
                              className="day-card add-day"
                              onClick={() =>
                                askName("Add a workout day", (name) => {
                                  const id = uid();
                                  update((s) => {
                                    s.plans
                                      .find((p) => p.id === currentPlan.id)!
                                      .days.push({ id, name, movements: [] });
                                  });
                                  setSelectedDay(id);
                                })
                              }
                            >
                              <Plus size={24} />
                              <strong>Add workout day</strong>
                              <span>Upper, Lower, Push, Pull…</span>
                            </button>
                          </div>
                        </>
                      )}
                      {currentDay && (
                        <>
                          <div className="section-title">
                            <div>
                              <button
                                className="secondary"
                                onClick={() => setSelectedDay(null)}
                              >
                                <ChevronLeft size={16} />
                                Back to plan
                              </button>
                              <h2>{currentDay.name}</h2>
                              <small role="status">{saveStatus}</small>
                            </div>
                            <div className="actions">
                              <button
                                className="ghost"
                                onClick={() =>
                                  askName(
                                    "Rename workout day",
                                    (name) =>
                                      modifyDay((d) => {
                                        d.name = name;
                                      }),
                                    currentDay.name,
                                  )
                                }
                              >
                                Rename
                              </button>
                              <button
                                className="ghost"
                                onClick={() =>
                                  update((s) => {
                                    const p = s.plans.find(
                                      (p) => p.id === currentPlan.id,
                                    )!;
                                    const copy = structuredClone(currentDay);
                                    copy.id = uid();
                                    copy.name += " (copy)";
                                    copy.movements = copy.movements.map(
                                      (m) => ({
                                        ...m,
                                        id: uid(),
                                        sets: m.sets.map((t) => ({
                                          ...t,
                                          id: uid(),
                                        })),
                                      }),
                                    );
                                    p.days.push(copy);
                                  })
                                }
                              >
                                Duplicate day
                              </button>
                              <button
                                className="ghost"
                                onClick={() =>
                                  confirm(
                                    "Delete workout day?",
                                    "This removes the day from your plan.",
                                    () => {
                                      update((s) => {
                                        const p = s.plans.find(
                                          (p) => p.id === currentPlan.id,
                                        )!;
                                        p.days = p.days.filter(
                                          (d) => d.id !== currentDay.id,
                                        );
                                        p.next = 0;
                                      });
                                      setSelectedDay(null);
                                    },
                                  )
                                }
                              >
                                <Trash2 size={15} />
                              </button>
                            </div>
                          </div>
                          <button
                            className="primary"
                            disabled={!currentDay.movements.length}
                            onClick={() =>
                              launch(
                                currentDay.name,
                                currentDay.movements,
                                currentPlan.id,
                                currentDay.id,
                              )
                            }
                          >
                            Start
                          </button>
                          {renderMovements(
                            currentDay.movements,
                            (fn) => modifyDay((d) => fn(d.movements)),
                            true,
                          )}
                          <button
                            className="add-exercise"
                            onClick={() =>
                              openPicker((e) =>
                                modifyDay((d) =>
                                  d.movements.push(makeMovement(e)),
                                ),
                              )
                            }
                          >
                            <Plus size={18} />
                            Add exercise to {currentDay.name}
                          </button>
                        </>
                      )}
                    </>
                  ) : (
                    <Empty
                      title="Choose a plan"
                      description="Select a plan above to edit its workout days."
                    />
                  )}
                </>
              )}
            </>
          )}
          {tab === "workout" && (
            <>
              {currentWorkout ? (
                <>
                  {!historyEdit && !currentWorkout.guided?.overview ? (
                    <GuidedWorkout
                      state={state}
                      now={now}
                      lookup={exercise}
                      update={update}
                      notify={notify}
                      finish={finishWorkout}
                    />
                  ) : (
                    <>
                      {!historyEdit && (
                        <button
                          className="primary"
                          onClick={() =>
                            modifyWorkout((w) => {
                              w.guided = {
                                ...w.guided,
                                phase: w.guided?.phase ?? "intro",
                                overview: false,
                              };
                            })
                          }
                        >
                          Back to guided workout
                        </button>
                      )}
                      <div className="workout-summary">
                        <div>
                          <span className="tag green">
                            {historyEdit ? "EDITING HISTORY" : "LIVE WORKOUT"}
                          </span>
                          <input
                            className="workout-title-input"
                            aria-label="Workout name"
                            value={currentWorkout.name}
                            onChange={(e) =>
                              modifyWorkout((w) => {
                                w.name = e.target.value;
                              })
                            }
                          />
                          <p>
                            {dateLabel(currentWorkout.started)} ·{" "}
                            {completeCount(currentWorkout)} completed sets ·{" "}
                            {fmt(
                              toDisplayWeight(
                                recordedVolume(currentWorkout),
                                state.settings.weight,
                              ),
                            )}{" "}
                            {state.settings.weight} volume
                          </p>
                        </div>
                        <div className="actions">
                          {historyEdit ? (
                            <button
                              className="primary"
                              onClick={() => {
                                setHistoryEdit(null);
                                go("history");
                              }}
                            >
                              <Check size={16} />
                              Done editing
                            </button>
                          ) : (
                            <button className="primary" onClick={finishWorkout}>
                              <Check size={16} />
                              Finish workout
                            </button>
                          )}
                          <button
                            className="secondary"
                            onClick={() =>
                              confirm(
                                historyEdit
                                  ? "Delete workout?"
                                  : "Discard workout?",
                                historyEdit
                                  ? "This removes the workout from history."
                                  : "This removes your unfinished session.",
                                () => {
                                  if (historyEdit) {
                                    update((s) => {
                                      s.workouts = s.workouts.filter(
                                        (w) => w.id !== historyEdit,
                                      );
                                    });
                                    setHistoryEdit(null);
                                    go("history");
                                  } else {
                                    update((s) => {
                                      s.active = null;
                                      s.timer = null;
                                    });
                                  }
                                },
                              )
                            }
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                      {renderMovements(currentWorkout.movements, (fn, undo) =>
                        modifyWorkout((w) => fn(w.movements), undo),
                      )}
                      <button
                        className="add-exercise"
                        onClick={() =>
                          openPicker((e) =>
                            modifyWorkout((w) =>
                              w.movements.push(makeMovement(e)),
                            ),
                          )
                        }
                      >
                        <Plus size={18} />
                        Add exercise
                      </button>
                      <section className="panel">
                        <label className="field">
                          Workout notes
                          <textarea
                            placeholder="How did the session feel? Anything to remember?"
                            value={currentWorkout.notes}
                            onChange={(e) =>
                              modifyWorkout((w) => {
                                w.notes = e.target.value;
                              })
                            }
                          />
                        </label>
                        <div className="actions">
                          <button
                            className="secondary"
                            onClick={() => {
                              if (!state.plans.length) {
                                notify(
                                  "Create a plan first, then save this workout into it.",
                                );
                                return;
                              }
                              setModal(
                                <SaveDayForm
                                  plans={state.plans}
                                  name={currentWorkout.name}
                                  close={() => setModal(null)}
                                  save={(planId, name) => {
                                    update((s) => {
                                      s.plans
                                        .find((p) => p.id === planId)!
                                        .days.push({
                                          id: uid(),
                                          name,
                                          movements: structuredClone(
                                            currentWorkout.movements,
                                          ).map((m) => ({
                                            ...m,
                                            id: uid(),
                                            sets: m.sets.map((t) => ({
                                              ...t,
                                              id: uid(),
                                              done: false,
                                              skipped: false,
                                            })),
                                          })),
                                        });
                                    });
                                    setModal(null);
                                    notify("Saved as a workout day.");
                                  }}
                                />,
                              );
                            }}
                          >
                            <Save size={16} />
                            Save as plan day
                          </button>
                          {currentWorkout.planId && currentWorkout.dayId && (
                            <button
                              className="secondary"
                              onClick={() =>
                                confirm(
                                  "Update saved workout day?",
                                  "Replace the plan day’s exercise order, targets, rest periods, and notes with this session. Past workouts remain unchanged.",
                                  () => {
                                    update((s) => {
                                      const d = s.plans
                                        .find(
                                          (p) => p.id === currentWorkout.planId,
                                        )
                                        ?.days.find(
                                          (d) => d.id === currentWorkout.dayId,
                                        );
                                      if (d)
                                        d.movements = structuredClone(
                                          currentWorkout.movements,
                                        ).map((m) => ({
                                          ...m,
                                          id: uid(),
                                          sets: m.sets.map((t) => ({
                                            ...t,
                                            id: uid(),
                                            done: false,
                                            skipped: false,
                                          })),
                                        }));
                                    });
                                    notify("Saved workout day updated.");
                                  },
                                )
                              }
                            >
                              Update saved workout day
                            </button>
                          )}
                          <button
                            className="ghost"
                            disabled={
                              !undoRef.current ||
                              undoRef.current.id !== currentWorkout.id
                            }
                            onClick={() => {
                              if (
                                undoRef.current &&
                                undoRef.current.id === currentWorkout.id
                              ) {
                                const previous = structuredClone(
                                  undoRef.current,
                                );
                                update((s) => {
                                  if (historyEdit)
                                    s.workouts = s.workouts.map((w) =>
                                      w.id === previous.id ? previous : w,
                                    );
                                  else s.active = previous;
                                });
                                undoRef.current = null;
                                notify("Last change undone.");
                              }
                            }}
                          >
                            <RotateCcw size={15} />
                            Undo last set/removal
                          </button>
                        </div>
                      </section>
                    </>
                  )}
                </>
              ) : (
                <Empty
                  title="Ready when you are"
                  description="Start a saved workout day or build a session as you go."
                  action={
                    <div className="actions">
                      <button
                        className="primary"
                        onClick={() => launch("My workout")}
                      >
                        <Plus size={16} />
                        Start empty workout
                      </button>
                      <button className="secondary" onClick={() => go("plans")}>
                        Choose a plan
                      </button>
                    </div>
                  }
                />
              )}
            </>
          )}
          {tab === "body" && (
            <>
              <div className="stats-grid">
                <Stat
                  label="LATEST WEIGHT"
                  value={
                    lastWeight === undefined
                      ? "—"
                      : fmt(toDisplayWeight(lastWeight, state.settings.weight))
                  }
                  unit={state.settings.weight}
                  detail="Most recent recorded weigh-in"
                  icon={<Scale size={19} />}
                />
                <Stat
                  label="CHANGE SINCE FIRST"
                  value={
                    lastWeight === undefined
                      ? "—"
                      : fmt(
                          toDisplayWeight(
                            lastWeight -
                              (sortedBody.find((b) => b.weight !== undefined)
                                ?.weight ?? lastWeight),
                            state.settings.weight,
                          ),
                        )
                  }
                  unit={state.settings.weight}
                  detail="Recorded weight, not an estimate"
                  icon={<Activity size={19} />}
                />
                <Stat
                  label="GOAL WEIGHT"
                  value={
                    state.settings.goal === undefined
                      ? "—"
                      : fmt(
                          toDisplayWeight(
                            state.settings.goal,
                            state.settings.weight,
                          ),
                        )
                  }
                  unit={state.settings.weight}
                  detail="Optional · change in settings"
                  icon={<Heart size={19} />}
                />
                <Stat
                  label="BODY ENTRIES"
                  value={String(state.body.length)}
                  unit="records"
                  detail="Weight & measurements"
                  icon={<ClipboardList size={19} />}
                />
              </div>
              <section className="panel">
                <div className="section-title">
                  <h2>Progress over time</h2>
                  <select
                    aria-label="Body chart metric"
                    value={bodyMetric}
                    onChange={(e) => setBodyMetric(e.target.value)}
                  >
                    {[
                      "weight",
                      "fat",
                      "waist",
                      "chest",
                      "hips",
                      "arm",
                      "thigh",
                    ].map((k) => (
                      <option key={k} value={k}>
                        {k === "fat"
                          ? "Body fat"
                          : k[0].toUpperCase() + k.slice(1)}
                      </option>
                    ))}
                  </select>
                </div>
                <Chart
                  points={sortedBody
                    .filter(
                      (b) =>
                        typeof b[bodyMetric as keyof BodyEntry] === "number",
                    )
                    .map((b) => ({
                      date: b.date,
                      value:
                        bodyMetric === "weight"
                          ? toDisplayWeight(b.weight!, state.settings.weight)
                          : bodyMetric === "fat"
                            ? b.fat!
                            : toDisplayLength(
                                b[bodyMetric as keyof BodyEntry] as number,
                                state.settings.length,
                              ),
                    }))}
                  goal={
                    bodyMetric === "weight" && state.settings.goal !== undefined
                      ? toDisplayWeight(
                          state.settings.goal,
                          state.settings.weight,
                        )
                      : undefined
                  }
                  label={
                    bodyMetric === "weight"
                      ? state.settings.weight
                      : bodyMetric === "fat"
                        ? "%"
                        : state.settings.length
                  }
                />
                {bodyMetric === "weight" &&
                  state.body.some((b) => b.weight !== undefined) && (
                    <>
                      <h3 className="small-title">Seven-day average</h3>
                      <Chart
                        points={rollingWeight(state.body).map(
                          (p: { date: string; value: number }) => ({
                            ...p,
                            value: toDisplayWeight(
                              p.value,
                              state.settings.weight,
                            ),
                          }),
                        )}
                        label={state.settings.weight}
                      />
                    </>
                  )}
                <p className="hint">
                  Record at a consistent time and use the same measurement
                  landmarks. Tape measurements: stand relaxed, keep the tape
                  level, and avoid pulling it tight.
                </p>
              </section>
              <section className="panel">
                <div className="section-title">
                  <h2>Measurement journal</h2>
                  <span className="muted">{state.body.length} entries</span>
                </div>
                {!state.body.length ? (
                  <Empty
                    title="More than a number"
                    description="Log weight, body fat, or any body measurements. Each field is optional."
                  />
                ) : (
                  <div className="body-list">
                    {[...sortedBody].reverse().map((b) => (
                      <div className="body-row" key={b.id}>
                        <div className="grow">
                          <strong>
                            {dateLabel(b.date)}{" "}
                            <small>
                              {new Date(b.date).toLocaleTimeString(undefined, {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </small>
                          </strong>
                          <div className="body-values">
                            {[
                              "weight",
                              "fat",
                              "waist",
                              "chest",
                              "hips",
                              "arm",
                              "thigh",
                            ]
                              .filter(
                                (k) => b[k as keyof BodyEntry] !== undefined,
                              )
                              .map((k) => (
                                <span key={k}>
                                  {k === "fat" ? "Body fat" : k}:{" "}
                                  <b>
                                    {fmt(
                                      k === "weight"
                                        ? toDisplayWeight(
                                            b.weight!,
                                            state.settings.weight,
                                          )
                                        : k === "fat"
                                          ? b.fat!
                                          : toDisplayLength(
                                              b[k as keyof BodyEntry] as number,
                                              state.settings.length,
                                            ),
                                    )}{" "}
                                    {k === "weight"
                                      ? state.settings.weight
                                      : k === "fat"
                                        ? "%"
                                        : state.settings.length}
                                  </b>
                                </span>
                              ))}
                          </div>
                          {b.notes && <p>{b.notes}</p>}
                        </div>
                        <button
                          className="secondary"
                          onClick={() => startBody(b)}
                        >
                          Edit
                        </button>
                        <button
                          className="icon-button"
                          aria-label="Delete measurement"
                          onClick={() =>
                            confirm(
                              "Delete body entry?",
                              "This removes this measurement record.",
                              () =>
                                update((s) => {
                                  s.body = s.body.filter((x) => x.id !== b.id);
                                }),
                            )
                          }
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </>
          )}
          {tab === "history" && (
            <>
              {personalRecords.length > 0 && (
                <section className="panel">
                  <div className="section-title">
                    <h2>Personal records</h2>
                    <span className="muted">Best completed working loads</span>
                  </div>
                  <div className="records-grid">
                    {personalRecords.map((r) => (
                      <button
                        className="record-item"
                        key={r.exercise.id}
                        onClick={() => setDetail(r.exercise)}
                      >
                        <span>{r.exercise.name}</span>
                        <strong>
                          {r.weight
                            ? `${fmt(toDisplayWeight(r.weight, state.settings.weight))} ${state.settings.weight} × `
                            : ""}
                          {r.reps} reps
                        </strong>
                      </button>
                    ))}
                  </div>
                  <p className="hint">
                    Records stay separate for each exercise and machine.
                    Warmups, incomplete sets, and assisted-machine loads are
                    excluded.
                  </p>
                </section>
              )}
              <section className="panel">
                <div className="section-title">
                  <h2>Training calendar</h2>
                  <input
                    aria-label="History month"
                    type="month"
                    value={historyMonth}
                    onChange={(e) => setHistoryMonth(e.target.value)}
                  />
                </div>
                <Calendar
                  month={historyMonth}
                  workouts={state.workouts}
                  onPick={(date) => {
                    const records = state.workouts.filter(
                      (w) =>
                        localDate(new Date(w.started)).slice(0, 10) === date,
                    );
                    if (records.length === 1) {
                      setHistoryEdit(records[0].id);
                      go("workout", true);
                    } else if (records.length > 1)
                      setModal(
                        <div className="dialog">
                          <h2>{dateLabel(date + "T12:00")}</h2>
                          {records.map((w) => (
                            <button
                              className="recent-workout"
                              key={w.id}
                              onClick={() => {
                                setHistoryEdit(w.id);
                                setModal(null);
                                go("workout", true);
                              }}
                            >
                              <strong>{w.name}</strong>
                              <ChevronRight size={16} />
                            </button>
                          ))}
                        </div>,
                      );
                  }}
                />
              </section>
              <div className="section-title">
                <h2>Your workouts</h2>
                <span className="muted">{state.workouts.length} sessions</span>
              </div>
              {state.workouts.length ? (
                <div className="history-grid">
                  {[...state.workouts]
                    .sort((a, b) => b.started.localeCompare(a.started))
                    .map((w) => (
                      <article className="panel history-card" key={w.id}>
                        <span className="eyebrow">{dateLabel(w.started)}</span>
                        <h3>{w.name}</h3>
                        <p>
                          {w.movements.length} exercises · {completeCount(w)}{" "}
                          completed sets
                        </p>
                        <div className="history-volume">
                          {fmt(
                            toDisplayWeight(
                              recordedVolume(w),
                              state.settings.weight,
                            ),
                          )}
                          <span>{state.settings.weight} volume</span>
                        </div>
                        <button
                          className="secondary full"
                          onClick={() => {
                            setHistoryEdit(w.id);
                            go("workout", true);
                          }}
                        >
                          View & edit <ArrowRight size={15} />
                        </button>
                      </article>
                    ))}
                </div>
              ) : (
                <Empty
                  title="Your story is still beginning"
                  description="Completed workouts will appear here. You can edit past sessions at any time."
                />
              )}
            </>
          )}
          {tab === "equipment" && (
            <>
              <section className="panel gym-intro">
                <div className="gym-badge-icon">
                  <Dumbbell size={27} />
                </div>
                <div>
                  <span className="eyebrow">YOUR GYM PROFILE</span>
                  <h2>Anytime Fitness · Bedok South CC</h2>
                  <p>850 New Upper Changi Road, #02-22</p>
                  <p className="hint">
                    The branch lists equipment categories, not a complete
                    machine inventory. Confirm the items you have seen before
                    using availability filters.
                  </p>
                  <a
                    className="source-link"
                    href="https://www.anytimefitness.com/en-sg/locations/bedok-district-south-west-sg-0073"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Official equipment listing ↗
                  </a>
                </div>
              </section>
              <div className="section-title">
                <h2>Your equipment inventory</h2>
                <span className="muted">
                  {
                    state.equipment.filter((e) => e.confirmed && !e.unavailable)
                      .length
                  }{" "}
                  available
                </span>
              </div>
              <div className="equipment-grid">
                {state.equipment.map((eq) => (
                  <article
                    key={eq.id}
                    className={`equipment-card ${eq.confirmed ? "confirmed" : ""}`}
                  >
                    <div className="row">
                      <Dumbbell size={19} />
                      <span className={`tag ${eq.confirmed ? "green" : ""}`}>
                        {eq.confirmed
                          ? "Confirmed"
                          : eq.listed
                            ? "Publicly listed"
                            : "Unconfirmed"}
                      </span>
                    </div>
                    <h3>{eq.name}</h3>
                    <label className="toggle-label">
                      <input
                        type="checkbox"
                        checked={eq.confirmed}
                        onChange={(ev) =>
                          update((s) => {
                            s.equipment.find((e) => e.id === eq.id)!.confirmed =
                              ev.target.checked;
                          })
                        }
                      />
                      I have seen this equipment
                    </label>
                    <label className="toggle-label">
                      <input
                        type="checkbox"
                        checked={eq.unavailable}
                        disabled={!eq.confirmed}
                        onChange={(ev) =>
                          update((s) => {
                            s.equipment.find(
                              (e) => e.id === eq.id,
                            )!.unavailable = ev.target.checked;
                          })
                        }
                      />
                      Temporarily unavailable
                    </label>
                    <button
                      className="ghost"
                      onClick={() => {
                        setEquipment(eq.id);
                        setQuery("");
                        setMuscle("all");
                        setGymOnly(false);
                        setFavsOnly(false);
                        go("library");
                      }}
                    >
                      See exercises <ArrowRight size={14} />
                    </button>
                  </article>
                ))}
              </div>
              <p className="hint">
                Generic machine categories do not confirm individual machines.
                Confirm those separately. Equipment marked unavailable is
                excluded from gym-compatible results.
              </p>
            </>
          )}
          {tab === "settings" && (
            <div className="settings-grid">
              <div className="more-links">
                <a href="#history">
                  <History size={18} />
                  Workout history
                </a>
                <a href="#equipment">
                  <SlidersHorizontal size={18} />
                  My gym equipment
                </a>
                <a href="#library">
                  <Search size={18} />
                  Exercise library
                </a>
              </div>
              <section className="panel appearance-panel">
                <div>
                  <span className="eyebrow">MAKE YOURSELF AT HOME</span>
                  <h2>Choose your atmosphere</h2>
                  <p>Focused training or a cozy Sumikko corner.</p>
                </div>
                <div className="theme-options">
                  <button
                    className={`theme-choice ${!cozy ? "chosen" : ""}`}
                    aria-pressed={!cozy}
                    onClick={() =>
                      update((s) => {
                        s.settings.theme = "focus";
                      })
                    }
                  >
                    <span className="theme-swatch focus-swatch">
                      <Activity size={22} />
                    </span>
                    <strong>Focus</strong>
                    <small>Dark & crisp</small>
                    {!cozy && <Check size={16} />}
                  </button>
                  <button
                    className={`theme-choice ${cozy ? "chosen" : ""}`}
                    aria-pressed={cozy}
                    onClick={() =>
                      update((s) => {
                        s.settings.theme = "sumikko";
                      })
                    }
                  >
                    <span className="theme-swatch sumikko-swatch">
                      <CornerFriend kind="cat" />
                    </span>
                    <strong>Sumikko Gurashi</strong>
                    <small>Soft & cozy</small>
                    {cozy && <Check size={16} />}
                  </button>
                </div>
              </section>
              <section className="panel">
                <h2>Preferences</h2>
                <label className="field">
                  Weight unit
                  <select
                    value={state.settings.weight}
                    onChange={(e) =>
                      update((s) => {
                        s.settings.weight = e.target.value as "kg" | "lb";
                      })
                    }
                  >
                    <option value="kg">Kilograms (kg)</option>
                    <option value="lb">Pounds (lb)</option>
                  </select>
                </label>
                <label className="field">
                  Body measurement unit
                  <select
                    value={state.settings.length}
                    onChange={(e) =>
                      update((s) => {
                        s.settings.length = e.target.value as "cm" | "in";
                      })
                    }
                  >
                    <option value="cm">Centimetres (cm)</option>
                    <option value="in">Inches (in)</option>
                  </select>
                </label>
                <label className="field">
                  Distance unit
                  <select
                    value={state.settings.distance}
                    onChange={(e) =>
                      update((s) => {
                        s.settings.distance = e.target.value as "km" | "mi";
                      })
                    }
                  >
                    <option value="km">Kilometres (km)</option>
                    <option value="mi">Miles (mi)</option>
                  </select>
                </label>
                <label className="field">
                  Optional effort tracking
                  <select
                    value={state.settings.effort}
                    onChange={(e) =>
                      update((s) => {
                        s.settings.effort = e.target.value as
                          "off" | "RIR" | "RPE";
                      })
                    }
                  >
                    <option value="off">Off — keep it simple</option>
                    <option value="RIR">RIR — reps left in reserve</option>
                    <option value="RPE">RPE — perceived effort</option>
                  </select>
                </label>
                <p className="hint">
                  RIR: 0 means no extra reps left. RPE: 10 means maximal
                  perceived effort. Each value keeps its RIR or RPE convention.
                  Switching modes hides older ratings in the other convention
                  without converting them.
                </p>
                <label className="field">
                  Optional goal weight ({state.settings.weight})
                  <input
                    type="number"
                    min="1"
                    max={toDisplayWeight(1000, state.settings.weight)}
                    step=".1"
                    value={
                      state.settings.goal === undefined
                        ? ""
                        : Number(
                            toDisplayWeight(
                              state.settings.goal,
                              state.settings.weight,
                            ).toFixed(2),
                          )
                    }
                    placeholder="No goal set"
                    onChange={(e) =>
                      update((s) => {
                        s.settings.goal =
                          e.target.value === ""
                            ? undefined
                            : Math.min(
                                1000,
                                toStoredWeight(
                                  Math.max(
                                    1,
                                    Math.min(2200, Number(e.target.value)),
                                  ),
                                  s.settings.weight,
                                ),
                              );
                      })
                    }
                  />
                </label>
              </section>
              <div>
                <section className="panel">
                  <h2>Your data, your control</h2>
                  <p>
                    Records save automatically in this browser. They do not sync
                    to another device. Clearing site data removes your journal.
                  </p>
                  <div className="backup-status">
                    <Download size={20} />
                    <div>
                      <strong>
                        {state.settings.lastBackup
                          ? `Last export: ${dateLabel(state.settings.lastBackup)}`
                          : "No backup exported yet"}
                      </strong>
                      <span>Export regularly and before changing devices.</span>
                    </div>
                  </div>
                  <div className="actions">
                    <button className="primary" onClick={exportBackup}>
                      <Download size={16} />
                      Export full backup
                    </button>
                    <button
                      className="secondary"
                      onClick={() => fileRef.current?.click()}
                    >
                      <Upload size={16} />
                      Import backup
                    </button>
                    <button className="secondary" onClick={csvExport}>
                      Export CSVs
                    </button>
                  </div>
                  <input
                    type="file"
                    accept=".json,application/json"
                    hidden
                    ref={fileRef}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) void importFile(f);
                      e.target.value = "";
                    }}
                  />
                  <button
                    className="ghost"
                    onClick={async () => {
                      try {
                        notify(
                          (await navigator.storage.persist())
                            ? "Persistent browser storage enabled. Still keep backups."
                            : "Your browser did not grant persistent storage. Keep regular backups.",
                        );
                      } catch {
                        notify(
                          "Persistent storage is not supported by this browser.",
                        );
                      }
                    }}
                  >
                    Request persistent browser storage
                  </button>
                </section>
                <section className="panel">
                  <h2>Offline guides</h2>
                  <p>
                    Exercise text is available offline once the app is cached.
                    Download the media for your saved plans before heading to
                    the gym.
                  </p>
                  <button
                    className="secondary"
                    onClick={async () => {
                      try {
                        const cache = await caches.open("fitspoh-media-v1");
                        const media = [
                          ...new Set(
                            state.plans.flatMap((p) =>
                              p.days.flatMap((d) =>
                                d.movements.flatMap(
                                  (m) =>
                                    exercise(m.exerciseId)?.images.map(
                                      (img) =>
                                        new URL(
                                          `exercises/${img}`,
                                          document.baseURI,
                                        ).href,
                                    ) ?? [],
                                ),
                              ),
                            ),
                          ),
                        ];
                        if (!media.length) {
                          notify("Add exercises to a saved plan first.");
                          return;
                        }
                        let failed = 0;
                        for (const url of media) {
                          try {
                            await cache.add(url);
                          } catch {
                            failed++;
                          }
                        }
                        notify(
                          failed
                            ? `${media.length - failed} guides downloaded; ${failed} files could not be cached. Try again online.`
                            : "Plan guide images downloaded for offline use.",
                        );
                      } catch {
                        notify(
                          "Media download unavailable. Use a secure browser context.",
                        );
                      }
                    }}
                  >
                    <Download size={16} />
                    Download plan guides
                  </button>
                </section>
                <section className="panel">
                  <h2>About the exercise library</h2>
                  <p>
                    Exercise descriptions and position photos are adapted from
                    Free Exercise DB (Unlicense). Movement schematics are
                    original, simplified illustrations.
                  </p>
                  <a
                    className="source-link"
                    href="https://github.com/yuhonas/free-exercise-db"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Exercise data & licence ↗
                  </a>
                  <p className="hint">
                    Exercise-specific instructions describe setup and movement.
                    Generic cues supplement them. Personal notes and gym
                    settings are stored only on this device.
                  </p>
                </section>
              </div>
            </div>
          )}
        </div>
        <footer>
          FIT SPOH · BUILT FOR YOUR NEXT REP <span>{saveStatus}</span>
        </footer>
      </main>
      <nav
        className="mobile-nav"
        aria-label="Main navigation"
        inert={!!modal || !!picker || !!detail || bodyEdit !== undefined}
      >
        {(
          [
            ["dashboard", "Home", LayoutDashboard],
            ["plans", "Plans", ClipboardList],
            ["workout", "Train", Dumbbell],
            ["body", "Body", Scale],
          ] as const
        ).map(([key, label, Icon]) => (
          <a
            href={`#${key}`}
            key={key}
            onClick={() => {
              if (key === "workout") setHistoryEdit(null);
            }}
            className={`${tab === key ? "active" : ""} ${key === "workout" ? "train-tab" : ""}`}
            aria-current={tab === key ? "page" : undefined}
          >
            <Icon size={20} />
            <span>{label}</span>
          </a>
        ))}
        <a
          href="#settings"
          className={
            ["settings", "library", "equipment", "history"].includes(tab)
              ? "active"
              : ""
          }
          aria-current={tab === "settings" ? "page" : undefined}
        >
          <MoreHorizontal size={22} />
          <span>More</span>
        </a>
      </nav>
      {state.timer &&
        !historyEdit &&
        !(tab === "workout" && !state.active?.guided?.overview) && (
          <div className="timer-bar">
            <Timer size={18} />
            <strong>
              {now >= state.timer
                ? "Rest complete"
                : `${Math.floor(Math.ceil(Math.max(0, state.timer - now) / 1000) / 60)}:${String(Math.ceil(Math.max(0, state.timer - now) / 1000) % 60).padStart(2, "0")}`}
            </strong>
            <button
              className="ghost"
              onClick={() =>
                update((s) => {
                  s.timer = (s.timer ?? Date.now()) + 30000;
                })
              }
            >
              +30s
            </button>
            <button
              className="icon-button"
              aria-label="Dismiss rest timer"
              onClick={() =>
                update((s) => {
                  s.timer = null;
                })
              }
            >
              <X size={17} />
            </button>
          </div>
        )}
      {notice && (
        <div className="toast" role="status">
          {notice}
          <button
            aria-label="Dismiss notification"
            onClick={() => setNotice("")}
          >
            <X size={16} />
          </button>
        </div>
      )}
      {picker && (
        <div className="modal-backdrop">
          <div className="library-modal">
            <div className="section-title">
              <h2>Choose an exercise</h2>
              <button
                className="icon-button"
                aria-label="Close exercise picker"
                onClick={() => setPicker(null)}
              >
                <X />
              </button>
            </div>
            {renderLibrary(true)}
          </div>
        </div>
      )}
      {detail && (
        <div className="modal-backdrop detail-backdrop">
          <div className="detail-modal">
            <button
              className="modal-close icon-button"
              aria-label="Close exercise guide"
              onClick={() => setDetail(null)}
            >
              <X />
            </button>
            <span className="eyebrow">EXERCISE GUIDE · {detail.level}</span>
            <h2>{detail.name}</h2>
            <div className="tags">
              {detail.primaryMuscles.map((m) => (
                <span className="tag green" key={m}>
                  {m}
                </span>
              ))}
              {detail.secondaryMuscles.map((m) => (
                <span className="tag" key={m}>
                  {m}
                </span>
              ))}
            </div>
            {detail.animation && <MovementDemo kind={detail.animation} />}
            <div className="position-images">
              {detail.images.map((img, i) => (
                <figure key={img}>
                  <img
                    loading="lazy"
                    src={`exercises/${img}`}
                    alt={`${detail.name}: ${i === 0 ? "start" : "finish"} position`}
                    onError={(e) => {
                      e.currentTarget.style.display = "none";
                    }}
                  />
                  <figcaption>
                    {i === 0 ? "Start position" : "Finish position"}
                  </figcaption>
                </figure>
              ))}
            </div>
            <h3>Setup & movement</h3>
            <ol className="instruction-list">
              {detail.instructions.map((step, i) => (
                <li key={i}>{step}</li>
              ))}
            </ol>
            <h3>Technique cues</h3>
            <ul>
              {detail.cues.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
            <h3>Common mistakes</h3>
            <ul>
              {detail.mistakes.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
            <p className="hint">
              Equipment:{" "}
              {detail.required
                .map(
                  (id) => state.equipment.find((e) => e.id === id)?.name ?? id,
                )
                .join(" + ") || "Bodyweight"}
            </p>
            <label className="field">
              My technique notes
              <textarea
                placeholder="Cues that work for you…"
                value={state.exerciseNotes[detail.id] ?? ""}
                onChange={(ev) =>
                  update((s) => {
                    s.exerciseNotes[detail.id] = ev.target.value;
                  })
                }
              />
            </label>
            <label className="field">
              Bedok CC machine setup
              <input
                placeholder="Seat height, pin position, grip, attachment…"
                value={state.setupNotes[detail.id] ?? ""}
                onChange={(ev) =>
                  update((s) => {
                    s.setupNotes[detail.id] = ev.target.value;
                  })
                }
              />
            </label>
            {state.workouts.some((w) =>
              w.movements.some((m) => m.exerciseId === detail.id),
            ) && (
              <>
                <h3>Completed performance</h3>
                <Chart
                  points={state.workouts.flatMap((w) => {
                    const sets = w.movements
                      .filter((m) => m.exerciseId === detail.id)
                      .flatMap((m) =>
                        m.sets.filter((s) => s.done && s.type !== "warmup"),
                      );
                    return sets.length
                      ? [
                          {
                            date: w.started,
                            value:
                              detail.mode === "strength"
                                ? toDisplayWeight(
                                    Math.max(...sets.map((s) => s.weight)),
                                    state.settings.weight,
                                  )
                                : Math.max(...sets.map((s) => s.seconds)) / 60,
                          },
                        ]
                      : [];
                  })}
                  label={
                    detail.mode === "strength"
                      ? state.settings.weight
                      : "minutes"
                  }
                />
                <p className="hint">
                  Best completed{" "}
                  {detail.mode === "strength" ? "load" : "duration"} per
                  session. Assistance values are not treated as strength
                  records.
                </p>
              </>
            )}
            <div className="actions">
              <button
                className="primary"
                onClick={() => {
                  if (picker) {
                    picker(detail);
                    setPicker(null);
                    setDetail(null);
                  } else if (state.active) {
                    update((s) =>
                      s.active!.movements.push(makeMovement(detail)),
                    );
                    setDetail(null);
                    go("workout");
                  } else {
                    launch("My workout", [makeMovement(detail)]);
                    setDetail(null);
                  }
                }}
              >
                <Plus size={16} />
                {picker
                  ? "Add exercise"
                  : state.active
                    ? "Add to workout"
                    : "Start workout with this"}
              </button>
              <button
                className="secondary"
                onClick={() => {
                  setDetail(null);
                  go("plans");
                  notify(
                    "Choose a plan day, then use Add exercise to include this movement.",
                  );
                }}
              >
                Add to a plan
              </button>
            </div>
          </div>
        </div>
      )}
      {bodyEdit !== undefined && (
        <div className="modal-backdrop">
          <form
            className="dialog body-dialog"
            onSubmit={(ev) => {
              ev.preventDefault();
              const b: BodyEntry = {
                id: bodyEdit?.id ?? uid(),
                date: new Date(bodyForm.date).toISOString(),
                notes: bodyForm.notes,
              };
              let fields = 0;
              for (const key of [
                "weight",
                "fat",
                "waist",
                "chest",
                "hips",
                "arm",
                "thigh",
              ])
                if (bodyForm[key] !== "") {
                  let n = Number(bodyForm[key]);
                  n =
                    key === "weight"
                      ? toStoredWeight(n, state.settings.weight)
                      : key === "fat"
                        ? n
                        : toStoredLength(n, state.settings.length);
                  if (
                    !Number.isFinite(n) ||
                    n < 0 ||
                    n > (key === "fat" ? 100 : 1000)
                  ) {
                    notify(
                      "Enter valid, non-negative measurements. Body fat must be between 0 and 100%.",
                    );
                    return;
                  }
                  (b as unknown as Record<string, unknown>)[key] = n;
                  fields++;
                }
              if (!fields) {
                notify("Fill in at least one measurement.");
                return;
              }
              update((s) => {
                if (bodyEdit)
                  s.body = s.body.map((x) => (x.id === bodyEdit.id ? b : x));
                else s.body.push(b);
              });
              setBodyEdit(undefined);
              notify("Body stats saved.");
            }}
          >
            <div className="section-title">
              <h2>{bodyEdit ? "Edit body entry" : "Log body stats"}</h2>
              <button
                type="button"
                className="icon-button"
                aria-label="Close body entry"
                onClick={() => setBodyEdit(undefined)}
              >
                <X />
              </button>
            </div>
            <label className="field">
              Date & time
              <input
                required
                type="datetime-local"
                value={bodyForm.date}
                onChange={(e) =>
                  setBodyForm({ ...bodyForm, date: e.target.value })
                }
              />
            </label>
            <div className="form-grid">
              {["weight", "fat", "waist", "chest", "hips", "arm", "thigh"].map(
                (k) => (
                  <label className="field" key={k}>
                    {k === "fat" ? "Body fat" : k[0].toUpperCase() + k.slice(1)}{" "}
                    (
                    {k === "weight"
                      ? state.settings.weight
                      : k === "fat"
                        ? "%"
                        : state.settings.length}
                    )
                    <input
                      type="number"
                      min="0"
                      step=".1"
                      placeholder="Optional"
                      value={bodyForm[k]}
                      onChange={(e) =>
                        setBodyForm({ ...bodyForm, [k]: e.target.value })
                      }
                    />
                  </label>
                ),
              )}
            </div>
            <p className="hint">
              Waist: use the same landmark each time. Chest/hips: measure around
              the fullest part. Arm/thigh: record the same side and position.
            </p>
            <label className="field">
              Notes
              <textarea
                value={bodyForm.notes}
                onChange={(e) =>
                  setBodyForm({ ...bodyForm, notes: e.target.value })
                }
                placeholder="Time of day, measurement context…"
              />
            </label>
            <button className="primary full" type="submit">
              <Check size={16} />
              Save entry
            </button>
          </form>
        </div>
      )}
      {modal && (
        <div className="modal-backdrop" onClick={() => setModal(null)}>
          <div onClick={(e) => e.stopPropagation()}>{modal}</div>
        </div>
      )}
    </div>
  );
}
function PlayIcon() {
  return <ArrowRight size={15} />;
}
function Stat({
  label,
  value,
  unit,
  detail,
  icon,
}: {
  label: string;
  value: string;
  unit: string;
  detail: string;
  icon: React.ReactNode;
}) {
  return (
    <article className="stat-card">
      <div className="row">
        <span className="eyebrow">{label}</span>
        <span className="stat-icon">{icon}</span>
      </div>
      <div className="stat-value">
        {value}
        <span>{unit}</span>
      </div>
      <p>{detail}</p>
    </article>
  );
}
function ExerciseImage({ exercise }: { exercise: Exercise }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [exercise.id]);
  return exercise.images[0] && !failed ? (
    <img
      loading="lazy"
      src={`exercises/${exercise.images[0]}`}
      alt={`${exercise.name} setup`}
      onError={() => setFailed(true)}
    />
  ) : (
    <div className="image-placeholder">
      <Dumbbell size={36} />
      <span>{exercise.primaryMuscles[0] ?? "Custom exercise"}</span>
    </div>
  );
}
function NumberInput({
  label,
  value,
  onChange,
  step,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  step: number;
}) {
  return (
    <input
      aria-label={label}
      className="number"
      type="number"
      min="0"
      max="100000"
      step={step}
      inputMode={step === 1 ? "numeric" : "decimal"}
      onFocus={(e) => e.currentTarget.select()}
      value={Number(value.toFixed(2))}
      onChange={(e) => {
        const n = Number(e.target.value);
        if (Number.isFinite(n)) onChange(Math.max(0, Math.min(100000, n)));
      }}
    />
  );
}
function DurationInput({
  seconds,
  onChange,
}: {
  seconds: number;
  onChange: (n: number) => void;
}) {
  return (
    <div className="duration-input">
      <input
        type="number"
        min="0"
        max="10080"
        aria-label="Duration minutes"
        inputMode="numeric"
        value={Math.floor(seconds / 60)}
        onChange={(e) =>
          onChange(
            Math.max(0, Math.min(10080, Number(e.target.value))) * 60 +
              (seconds % 60),
          )
        }
      />
      <span>:</span>
      <input
        type="number"
        min="0"
        max="59"
        aria-label="Duration seconds"
        inputMode="numeric"
        value={seconds % 60}
        onChange={(e) =>
          onChange(
            Math.floor(seconds / 60) * 60 +
              Math.max(0, Math.min(59, Number(e.target.value))),
          )
        }
      />
    </div>
  );
}
function NameForm({
  title,
  initial,
  save,
  close,
}: {
  title: string;
  initial: string;
  save: (s: string) => void;
  close: () => void;
}) {
  const [value, setValue] = useState(initial);
  return (
    <form
      className="dialog"
      onSubmit={(e) => {
        e.preventDefault();
        if (value.trim()) save(value.trim());
      }}
    >
      <h2>{title}</h2>
      <label className="field">
        Name
        <input
          autoFocus
          required
          maxLength={100}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Give it a name…"
        />
      </label>
      <div className="actions">
        <button type="button" className="secondary" onClick={close}>
          Cancel
        </button>
        <button className="primary" type="submit">
          Save
        </button>
      </div>
    </form>
  );
}
function SaveDayForm({
  plans,
  name,
  save,
  close,
}: {
  plans: Plan[];
  name: string;
  save: (id: string, name: string) => void;
  close: () => void;
}) {
  const [plan, setPlan] = useState(plans[0].id),
    [value, setValue] = useState(name);
  return (
    <form
      className="dialog"
      onSubmit={(e) => {
        e.preventDefault();
        if (value.trim()) save(plan, value.trim());
      }}
    >
      <h2>Save as a workout day</h2>
      <label className="field">
        Plan
        <select value={plan} onChange={(e) => setPlan(e.target.value)}>
          {plans.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        Day name
        <input
          required
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
      </label>
      <div className="actions">
        <button type="button" className="secondary" onClick={close}>
          Cancel
        </button>
        <button className="primary">Save day</button>
      </div>
    </form>
  );
}
function CustomExerciseForm({
  equipment,
  save,
  close,
}: {
  equipment: { id: string; name: string }[];
  save: (e: Exercise) => void;
  close: () => void;
}) {
  const [name, setName] = useState(""),
    [muscle, setMuscle] = useState("chest"),
    [mode, setMode] = useState<Exercise["mode"]>("strength"),
    [required, setRequired] = useState<string[]>([]),
    [instructions, setInstructions] = useState("");
  return (
    <form
      className="dialog"
      onSubmit={(ev) => {
        ev.preventDefault();
        if (!name.trim()) return;
        save({
          id: `custom-${uid()}`,
          name: name.trim(),
          primaryMuscles: [muscle],
          secondaryMuscles: [],
          equipment: required[0] ?? "body only",
          required,
          level: "custom",
          category: mode === "cardio" ? "cardio" : "strength",
          mode,
          instructions: instructions
            .split("\n")
            .map((s) => s.trim())
            .filter(Boolean),
          images: [],
          cues: [],
          mistakes: [],
        });
      }}
    >
      <h2>Custom exercise</h2>
      <label className="field">
        Name
        <input
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </label>
      <label className="field">
        Primary muscle
        <select value={muscle} onChange={(e) => setMuscle(e.target.value)}>
          {[
            "chest",
            "quadriceps",
            "hamstrings",
            "glutes",
            "lats",
            "middle back",
            "shoulders",
            "biceps",
            "triceps",
            "abdominals",
            "calves",
          ].map((m) => (
            <option key={m}>{m}</option>
          ))}
        </select>
      </label>
      <label className="field">
        Logging type
        <select
          value={mode}
          onChange={(e) => setMode(e.target.value as Exercise["mode"])}
        >
          <option value="strength">Weight and reps</option>
          <option value="duration">Duration only</option>
          <option value="cardio">Duration and distance</option>
        </select>
      </label>
      <label className="field">
        Required equipment (select all)
        <select
          multiple
          size={5}
          value={required}
          onChange={(e) =>
            setRequired(
              Array.from(e.target.selectedOptions).map((o) => o.value),
            )
          }
        >
          {equipment.map((eq) => (
            <option key={eq.id} value={eq.id}>
              {eq.name}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        Guide (one step per line)
        <textarea
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
        />
      </label>
      <div className="actions">
        <button type="button" className="secondary" onClick={close}>
          Cancel
        </button>
        <button className="primary">Add exercise</button>
      </div>
    </form>
  );
}
function Calendar({
  month,
  workouts,
  onPick,
}: {
  month: string;
  workouts: Workout[];
  onPick: (s: string) => void;
}) {
  const [year, m] = month.split("-").map(Number);
  if (!year || !m) return null;
  const first = new Date(year, m - 1, 1),
    offset = (first.getDay() + 6) % 7,
    days = new Date(year, m, 0).getDate();
  return (
    <div className="calendar">
      {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
        <span className="calendar-label" key={d}>
          {d}
        </span>
      ))}
      {Array.from({ length: offset }, (_, i) => (
        <span key={`empty${i}`} />
      ))}
      {Array.from({ length: days }, (_, i) => {
        const date = `${month}-${String(i + 1).padStart(2, "0")}`,
          count = workouts.filter(
            (w) => localDate(new Date(w.started)).slice(0, 10) === date,
          ).length;
        return (
          <button
            key={date}
            className={`${count ? "trained" : ""} ${date === today() ? "today" : ""}`}
            onClick={() => onPick(date)}
            aria-label={`${date}, ${count} workouts`}
          >
            {i + 1}
            {count > 0 && <i />}
          </button>
        );
      })}
    </div>
  );
}
createRoot(document.getElementById("root")!).render(<App />);
if ("serviceWorker" in navigator)
  window.addEventListener("load", () => {
    void navigator.serviceWorker.register("./sw.js").catch(() => {});
  });
