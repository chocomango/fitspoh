import { useEffect, useRef, useState } from "react";
import type { Exercise, State, Workout, SetLog, Movement } from "./types";
import { currentStep, workoutQueue } from "./guided";
import { postpone, weightIncrement, saveIncrement } from "./mobile.mjs";
import { useWorkoutWakeLock } from "./useWorkoutWakeLock";
import { setIssue, sessionComparisons } from "./workout-feedback.mjs";
import { enableRestAlerts } from "./rest-alerts";
import {
  guideSet,
  beginCorrection,
  saveCorrection,
  cancelCorrection,
  pauseWorkout,
  resumeWorkout,
  rememberSetUndo,
  skipCurrentSet,
  undoLastSet,
  preserveGuidedDraft,
  nextStep,
  insertWorkoutSet,
  moveWorkoutSet,
  deleteWorkoutSet,
  restartWorkoutSet,
  undoWorkoutAction,
  recordWorkoutAction,
} from "./workout-actions.mjs";
import { SetManager } from "./SetManager";
import { ExercisePhoto } from "./components";
import {
  toDisplayDistance,
  toStoredDistance,
  displayLoad,
  storedLoad,
  loadUnit,
} from "./domain.mjs";
type Props = {
  state: State;
  now: number;
  lookup: (id: string) => Exercise | undefined;
  update: (fn: (s: State) => void) => void;
  notify: (message: string) => void;
  finish: () => void;
  alternative: (movement: Movement) => void;
  addExercise: () => void;
  cancelEmpty: () => void;
};
const number = (n: number) => Number(n.toFixed(2));
export function GuidedWorkout({
  state,
  now,
  lookup,
  update,
  notify,
  finish,
  alternative,
  addExercise,
  cancelEmpty,
}: Props) {
  const [busy, setBusy] = useState(false);
  const [entryError, setEntryError] = useState("");
  const [incrementText, setIncrementText] = useState<string | null>(null);
  const setStrip = useRef<HTMLDivElement>(null);
  const w = state.active!;
  const paused = w.pausedAt !== undefined;
  const wakeStatus = useWorkoutWakeLock(!!state.settings.keepAwake && !paused);
  const step = currentStep(w);
  const g = w.guided;
  const phase = g?.phase ?? "intro";
  const correcting = !!g?.editing;
  const e = step && lookup(step.movement.exerciseId);
  useEffect(() => {
    setIncrementText(null);
  }, [e?.id, state.settings.weight]);
  useEffect(() => {
    const strip = setStrip.current;
    const selected = strip?.querySelector<HTMLElement>(".set-chip.active");
    if (!strip || !selected) return;
    strip.scrollLeft = Math.max(0, selected.offsetLeft - strip.offsetLeft - 8);
  }, [step?.set.id]);
  useEffect(() => {
    const section = document.querySelector<HTMLElement>(".guided-workout");
    if (section && section.getBoundingClientRect().top < 60)
      section.scrollIntoView({ block: "start" });
  }, [step?.set.id, correcting]);
  const last = workoutQueue(w.movements, w.setOrder ?? "exercise").find(
    (x) => x.set.id === g?.lastSetId,
  );
  const previous =
    e &&
    [...state.workouts]
      .sort((a, b) => b.started.localeCompare(a.started))
      .flatMap((x) => x.movements)
      .find((m) => m.exerciseId === e.id && m.sets.some((s) => s.done));
  const summary = !step || phase === "summary";
  const resting = phase === "rest";
  const remaining = Math.max(0, Math.ceil(((state.timer ?? now) - now) / 1000));
  const allSets = w.movements.flatMap((m) => m.sets);
  const doneCount = allSets.filter((s) => s.done).length;
  const skippedCount = allSets.filter((s) => s.skipped && !s.done).length;
  const comparisons = summary ? sessionComparisons(w, state.workouts) : [];
  useEffect(() => {
    if (
      !g ||
      (step && (g.setId !== step.set.id || phase === "summary")) ||
      (!step && phase !== "summary")
    ) {
      update((s) => {
        const active = s.active;
        if (!active) return;
        const next = currentStep(active);
        active.guided = {
          ...active.guided,
          setId: next?.set.id,
          phase: next ? (!g && s.timer ? "rest" : "intro") : "summary",
        };
        if (g) s.timer = null;
      });
    }
  }, [w.id, step?.set.id, g?.setId, phase]);
  const change = (fn: (active: Workout) => void) => {
    setEntryError("");
    update((s) => {
      if (s.active) fn(s.active);
    });
  };
  const start = () => {
    setEntryError("");
    update((s) => {
      if (s.active)
        s.active.guided = {
          ...s.active.guided,
          setId: step?.set.id,
          phase: "entry",
        };
      s.timer = null;
    });
  };
  const result = (set: SetLog, metadata = e) =>
    metadata?.mode === "strength"
      ? set.needsLoad
        ? `Choose load · ${set.reps} reps`
        : `${number(displayLoad(set.weight, state.settings.weight, metadata))} ${loadUnit(state.settings.weight, metadata)} × ${set.reps} reps`
      : `${set.seconds}s${metadata?.mode === "cardio" ? ` · ${number(toDisplayDistance(set.distance, state.settings.distance))} ${state.settings.distance}` : ""}`;
  const complete = () => {
    if (!step || !e) return;
    const missingLoad = step.set.needsLoad || g?.draft?.values.weight === "";
    const issue = setIssue(
      {
        ...step.set,
        needsLoad: missingLoad,
      },
      e,
    );
    if (issue) {
      setEntryError(issue);
      notify("Check the set entry before completing it.");
      document
        .getElementById(
          "guided-" +
            (missingLoad
              ? "weight"
              : e.mode === "strength"
                ? "reps"
                : "seconds"),
        )
        ?.focus();
      return;
    }
    setEntryError("");
    if (correcting) {
      update((s) => saveCorrection(s));
      notify("Correction saved. Continue where you left off.");
      return;
    }
    const oldBest = Math.max(
      0,
      ...[...state.workouts, w]
        .flatMap((x) => x.movements)
        .filter((m) => m.exerciseId === e.id)
        .flatMap((m) => m.sets)
        .filter((s) => s.done && s.type === "working" && s.reps > 0)
        .map((s) => s.weight),
    );
    if (
      e.mode === "strength" &&
      !/assisted/i.test(e.name) &&
      step.set.type === "working" &&
      step.set.reps > 0 &&
      step.set.weight > oldBest &&
      oldBest > 0
    )
      notify(`New weight record! ${result(step.set)}`);
    update((s) => {
      const active = s.active!;
      const current = currentStep(active)!;
      if (
        !current ||
        current.set.id !== step.set.id ||
        active.guided?.phase !== "entry"
      )
        return;
      if (!rememberSetUndo(s, current.set.id)) return;
      if (active.deferredInputs) delete active.deferredInputs[current.set.id];
      current.set.done = true;
      current.set.skipped = false;
      const next = nextStep(active, current.set.id);
      if (next) {
        const prior = next.movement.sets
          .slice(0, next.index)
          .reverse()
          .find(
            (s) =>
              s.done && (next.set.type === "warmup" || s.type !== "warmup"),
          );
        if (
          prior &&
          active.deferredInputs?.[next.set.id]?.weight === undefined
        ) {
          next.set.weight = prior.weight;
          next.set.needsLoad = false;
        }
      }
      // A grouped round ends before the index advances or the group changes.
      const roundEnd =
        active.setOrder !== "circuit" ||
        !current.movement.superset ||
        !next ||
        next.movement.superset !== current.movement.superset ||
        next.index !== current.index;
      const sameExercise = next?.movement.id === current.movement.id;
      const rest =
        !!next &&
        roundEnd &&
        ((active.setOrder === "circuit" && !!current.movement.superset) ||
          sameExercise);
      active.guided = {
        undo: active.guided?.undo,
        setId: next?.set.id,
        lastSetId: current.set.id,
        phase: !next ? "summary" : rest ? "rest" : "between",
      };
      s.timer = rest ? Date.now() + current.movement.rest * 1000 : null;
    });
  };
  const skip = () => {
    setEntryError("");
    update((s) => {
      const active = s.active!;
      const current = currentStep(active);
      if (!current || current.set.id !== step?.set.id) return;
      recordWorkoutAction(s, "Skip exercise");
      preserveGuidedDraft(active);
      current.movement.sets
        .filter((x) => !x.done)
        .forEach((x) => {
          x.skipped = true;
        });
      const next = nextStep(active, current.set.id);
      active.guided = {
        undo: active.guided?.undo,
        setId: next?.set.id,
        phase: next ? "intro" : "summary",
      };
      s.timer = null;
    });
  };
  const field = (
    key: "weight" | "reps" | "seconds" | "distance" | "effort",
    label: string,
    max: number,
  ) => {
    if (!step) return null;
    let value = step.set[key] ?? 0;
    if (key === "weight") value = displayLoad(value, state.settings.weight, e);
    if (key === "distance")
      value = toDisplayDistance(value, state.settings.distance);
    const rawValues =
      g?.draft?.setId === step.set.id
        ? g.draft.values
        : w.deferredInputs?.[step.set.id];
    const shown =
      rawValues?.[key] ??
      (key === "weight" && step.set.needsLoad ? "" : number(value));
    const editValue = (text: string) => {
      const raw = Number(text);
      if (!Number.isFinite(raw) || raw < 0 || raw > max) return;
      change((active) => {
        const target = active.movements
          .flatMap((m) => m.sets)
          .find((x) => x.id === step.set.id);
        if (!target) return;
        active.guided = {
          ...active.guided,
          phase: "entry",
          draft: {
            setId: step.set.id,
            values: { ...rawValues, [key]: text },
          },
        };
        target[key] =
          key === "weight"
            ? storedLoad(raw, state.settings.weight, e)
            : key === "distance"
              ? toStoredDistance(raw, state.settings.distance)
              : raw;
        if (key === "weight" && !target.done) target.needsLoad = text === "";
        if (key === "effort" && state.settings.effort !== "off")
          target.effortKind = state.settings.effort;
      });
    };
    const quick = key === "weight" || key === "reps";
    const increment = key === "weight" && e ? weightIncrement(state, e) : 1;
    return (
      <div className="field" key={key}>
        <label htmlFor={"guided-" + key}>{label}</label>
        <input
          id={"guided-" + key}
          type="number"
          inputMode="decimal"
          min="0"
          max={max}
          step={key === "reps" || key === "seconds" ? "1" : "any"}
          aria-label={label}
          aria-invalid={entryError ? true : undefined}
          aria-describedby={entryError ? "guided-entry-error" : undefined}
          value={shown}
          onChange={(ev) => editValue(ev.target.value)}
        />
        {quick && (
          <div className="quick-adjustments">
            {[-1, 1].map((direction) => (
              <button
                key={direction}
                type="button"
                className="secondary"
                aria-label={
                  direction < 0 ? "Decrease " + key : "Increase " + key
                }
                disabled={
                  key === "weight" && (!!step.set.needsLoad || shown === "")
                }
                onClick={() =>
                  editValue(
                    String(
                      number(
                        Math.min(
                          max,
                          Math.max(
                            0,
                            Number(shown || 0) + direction * increment,
                          ),
                        ),
                      ),
                    ),
                  )
                }
              >
                {direction < 0 ? "\u2212" : "+"}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  };
  const visit = (set: SetLog) => {
    setEntryError("");
    update((s) => {
      if (set.done) beginCorrection(s, set.id);
      else guideSet(s, set.id);
    });
    setBusy(false);
  };
  const addSet = (movement: Movement, warmup = false, navigate = false) => {
    update((s) => {
      const active = s.active;
      const target = active?.movements.find((m) => m.id === movement.id);
      if (
        !active ||
        !target ||
        active.guided?.editing ||
        active.pausedAt !== undefined
      )
        return;
      const source = warmup
        ? target.sets.find((set) => set.type !== "warmup")
        : target.sets.at(-1);
      const set = insertWorkoutSet(
        s,
        target.id,
        source?.id,
        warmup && source ? "before" : "after",
        warmup ? "warmup" : "working",
      );
      if (!set) return;
      if (warmup) {
        set.weight = 0;
        set.needsLoad = lookup(target.exerciseId)?.mode === "strength";
      }
      if (navigate || warmup || !step || source?.done) {
        guideSet(s, set.id);
        if (!warmup && source?.done && target.rest > 0) {
          active.guided = {
            ...active.guided,
            lastSetId: source.id,
            phase: "rest",
          };
          s.timer = Date.now() + target.rest * 1000;
        }
      }
    });
    notify(
      warmup
        ? "Warm-up added at the beginning of this exercise. Choose its load."
        : "Added another set to this exercise.",
    );
  };
  const restart = (setId: string) => {
    update((s) => {
      if (s.active?.guided?.editing?.setId === setId) cancelCorrection(s);
      restartWorkoutSet(s, setId);
    });
    setEntryError("");
    notify("Set reopened. Start here; your other completed sets stay saved.");
  };
  const manager = (movement: Movement) => (
    <SetManager
      key={movement.id}
      movement={movement}
      name={lookup(movement.exerciseId)?.name ?? "Exercise"}
      selectedId={step?.set.id}
      disabled={correcting || paused}
      result={(set) => result(set, lookup(movement.exerciseId))}
      visit={visit}
      restart={restart}
      move={(id, before) =>
        update((s) => {
          moveWorkoutSet(s, movement.id, id, before);
        })
      }
      remove={(id) => {
        update((s) => {
          deleteWorkoutSet(s, movement.id, id);
        });
        notify("Set deleted. Use Undo to restore it.");
      }}
      insert={(sourceId, placement, type) => {
        update((s) => {
          const set = insertWorkoutSet(
            s,
            movement.id,
            sourceId,
            placement,
            type,
          );
          if (set && type === "warmup") {
            set.weight = 0;
            set.needsLoad = lookup(movement.exerciseId)?.mode === "strength";
          }
        });
        notify("Set inserted at the position you chose.");
      }}
    />
  );
  return (
    <section className="guided-workout panel" aria-label="Guided workout">
      <div
        className={`section-title ${w.undoActions?.length ? "has-undo" : ""}`}
      >
        <strong>{w.name}</strong>
        <button
          className="secondary"
          disabled={correcting || paused}
          onClick={() =>
            change((active) => {
              preserveGuidedDraft(active);
              active.guided = { ...active.guided, phase, overview: true };
            })
          }
        >
          Overview
        </button>
        {!!w.undoActions?.length && (
          <button
            className="secondary"
            aria-label="Undo last action"
            title={"Undo: " + w.undoActions.at(-1)?.label}
            disabled={correcting || paused}
            onClick={() => {
              update((s) => {
                undoWorkoutAction(s);
              });
              setEntryError("");
              setBusy(false);
            }}
          >
            Undo
          </button>
        )}
        {!paused && (
          <button
            className="secondary"
            aria-label="Pause workout"
            disabled={correcting}
            onClick={() => update((s) => pauseWorkout(s))}
          >
            Pause
          </button>
        )}
      </div>
      {(paused || summary) && (
        <>
          <p className="workout-session-status">
            {doneCount} sets saved ·{" "}
            {Math.max(
              0,
              Math.floor(((w.pausedAt ?? now) - Date.parse(w.started)) / 60000),
            )}{" "}
            min elapsed
          </p>
        </>
      )}
      {paused ? (
        <div className="workout-pause" role="status">
          <h2>Workout paused</h2>
          <p>
            Your entries are saved. Your rest timer will continue when you
            resume.
          </p>
          {w.pausedRestMs !== undefined && (
            <p role="timer" aria-label="Paused rest countdown">
              {Math.ceil(w.pausedRestMs / 1000)} seconds remaining
            </p>
          )}
          <button
            className="primary guided-primary"
            onClick={() => update((s) => resumeWorkout(s))}
          >
            Resume workout
          </button>
        </div>
      ) : !allSets.length ? (
        <>
          <h2>Build this workout</h2>
          <p>
            Add your first exercise. You can choose its sets, load and rest time
            before logging anything.
          </p>
          <button className="primary guided-primary" onClick={addExercise}>
            Add first exercise
          </button>
          <button className="secondary" onClick={cancelEmpty}>
            Cancel empty workout
          </button>
        </>
      ) : summary ? (
        <>
          <h2>Workout review</h2>
          <p>
            {w.movements.flatMap((m) => m.sets).filter((s) => s.done).length}{" "}
            completed sets
          </p>
          <p className="hint">
            {Math.max(1, Math.round((now - Date.parse(w.started)) / 60000))} min
            · {skippedCount} skipped sets
          </p>
          {w.movements.map((m) => (
            <div className="guided-results" key={m.id}>
              <h3>{lookup(m.exerciseId)?.name}</h3>
              {m.sets.map((s, i) => (
                <p key={s.id}>
                  Set {i + 1}:{" "}
                  {s.done
                    ? result(s, lookup(m.exerciseId))
                    : s.skipped
                      ? "Skipped"
                      : "Unfinished"}
                </p>
              ))}
              {manager(m)}
              {comparisons
                .filter(
                  (row) =>
                    row.movementId === m.id &&
                    lookup(row.exerciseId)?.mode === "strength" &&
                    !/assisted/i.test(lookup(row.exerciseId)?.name ?? ""),
                )
                .map((row) => {
                  const metadata = lookup(row.exerciseId);
                  return (
                    <div
                      className="guided-comparison"
                      key={row.movementId + ":" + row.weight}
                    >
                      <p>
                        {number(
                          displayLoad(
                            row.weight,
                            state.settings.weight,
                            metadata,
                          ),
                        )}{" "}
                        {loadUnit(state.settings.weight, metadata)}
                        {metadata?.equipment === "dumbbell"
                          ? " per hand"
                          : ""}: {row.reps} total reps across {row.sets} working
                        sets
                      </p>
                      <p className="hint">
                        {row.previousReps === undefined
                          ? "First completed working sets at this load."
                          : `Last session at this load: ${row.previousReps} reps across ${row.previousSets} working sets.`}
                      </p>
                    </div>
                  );
                })}
            </div>
          ))}
          {last && (
            <button
              className="secondary"
              onClick={() =>
                update((s) => {
                  s.timer = Date.now() + last.movement.rest * 1000;
                })
              }
            >
              Start rest
            </button>
          )}
          {state.timer && (
            <div className="guided-rest">
              <div className="guided-countdown" role="timer">
                {remaining
                  ? `${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, "0")}`
                  : "Ready"}
              </div>
              <button
                className="secondary"
                onClick={() =>
                  update((s) => {
                    s.timer = null;
                  })
                }
              >
                Dismiss rest timer
              </button>
            </div>
          )}
          <button
            className="primary guided-primary"
            disabled={doneCount === 0}
            onClick={finish}
          >
            Finish workout
          </button>
          {doneCount === 0 && (
            <button
              className="secondary"
              onClick={() => {
                update((s) => {
                  if (!s.active) return;
                  s.active.movements.forEach((m) =>
                    m.sets.forEach((set) => {
                      set.skipped = false;
                    }),
                  );
                  s.active.guided = { phase: "intro" };
                  s.timer = null;
                });
              }}
            >
              Restore skipped sets
            </button>
          )}
        </>
      ) : e && step ? (
        <>
          <p className="eyebrow">
            Exercise {w.movements.indexOf(step.movement) + 1} of{" "}
            {w.movements.length} · Set {step.index + 1} of{" "}
            {step.movement.sets.length}
            {w.setOrder === "circuit" && step.movement.superset
              ? ` · Circuit ${step.movement.superset}`
              : ""}
          </p>
          <label className="workout-progress">
            <span>
              {doneCount} of {allSets.length - skippedCount} sets completed
              {skippedCount ? ` · ${skippedCount} skipped` : ""}
            </span>
            <progress
              aria-label="Workout set progress"
              value={doneCount}
              max={Math.max(1, allSets.length - skippedCount)}
            />
          </label>
          <h2>{e.name}</h2>
          {correcting && (
            <p className="correction-notice" role="status">
              Editing a saved set. Your completed-set count stays the same.
            </p>
          )}
          {resting ? (
            <div className="guided-rest">
              <p>
                {last
                  ? `Completed: ${result(last.set, lookup(last.movement.exerciseId))}`
                  : "Take a breather"}
              </p>
              <div
                className="guided-countdown"
                role="timer"
                aria-label="Rest countdown"
              >
                {remaining
                  ? `${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, "0")}`
                  : "Ready"}
              </div>
              <p>Next: {result(step.set)}</p>
              <div className="actions">
                <button
                  className="secondary"
                  onClick={() =>
                    update((s) => {
                      s.timer = Math.max(
                        Date.now(),
                        (s.timer ?? Date.now()) - 30000,
                      );
                    })
                  }
                >
                  −30 seconds
                </button>
                <button
                  className="secondary"
                  onClick={() =>
                    update((s) => {
                      s.timer =
                        Math.max(Date.now(), s.timer ?? Date.now()) + 30000;
                    })
                  }
                >
                  +30 seconds
                </button>
              </div>
              <div className="guided-action-bar">
                <button className="primary guided-primary" onClick={start}>
                  {remaining ? "Skip rest" : "Start next set"}
                </button>
              </div>
            </div>
          ) : phase === "entry" ? (
            <>
              <p className="guided-set-target">
                {correcting ? "Correct actual result" : step.set.type + " set"}
                {e.mode === "strength"
                  ? ` · Plan target: ${step.movement.repMin}–${step.movement.repMax} reps`
                  : ""}
              </p>
              {e.mode === "strength" && (
                <p className="guided-load-hint">
                  {e.loadKind
                    ? `Record ${loadUnit(state.settings.weight, e)}. See Targets & progression for the convention.`
                    : /assisted/i.test(e.name)
                      ? "Log the assistance weight."
                      : /dumbbell/i.test(e.equipment)
                        ? "Log the weight per hand."
                        : "Log the total load."}
                </p>
              )}
              <div className="guided-inputs">
                {e.mode === "strength" ? (
                  <>
                    {field(
                      "weight",
                      `Weight (${loadUnit(state.settings.weight, e)})`,
                      1000000,
                    )}
                    {field("reps", "Reps", 10000)}
                  </>
                ) : (
                  <>
                    {field("seconds", "Duration (seconds)", 604800)}
                    {e.mode === "cardio" &&
                      field(
                        "distance",
                        `Distance (${state.settings.distance})`,
                        10000,
                      )}
                  </>
                )}
                {state.settings.effort !== "off" &&
                  field("effort", state.settings.effort, 10)}
              </div>
              {correcting ? (
                <div className="guided-quick-actions">
                  <button
                    className="secondary"
                    onClick={() => {
                      update((s) => cancelCorrection(s));
                      setEntryError("");
                    }}
                  >
                    Cancel correction
                  </button>
                  <button
                    className="secondary"
                    onClick={() => restart(step.set.id)}
                  >
                    Restart this set
                  </button>
                </div>
              ) : (
                <div className="guided-quick-actions">
                  <button
                    className="secondary"
                    onClick={() => addSet(step.movement)}
                  >
                    Add another set
                  </button>
                  <button
                    className="ghost"
                    onClick={() => {
                      update((s) => {
                        if (
                          s.active &&
                          currentStep(s.active)?.set.id === step.set.id
                        )
                          skipCurrentSet(s);
                      });
                      setEntryError("");
                    }}
                  >
                    Skip this set
                  </button>
                </div>
              )}
              <div className="guided-action-bar">
                <button className="primary guided-primary" onClick={complete}>
                  {(() => {
                    if (correcting) return "Save correction";
                    const next = nextStep(w, step.set.id);
                    return next &&
                      (next.movement.id === step.movement.id ||
                        (w.setOrder === "circuit" &&
                          step.movement.superset &&
                          next.movement.superset === step.movement.superset &&
                          next.index !== step.index))
                      ? "Complete set & start rest"
                      : "Complete set";
                  })()}
                </button>
              </div>
              {entryError && (
                <p id="guided-entry-error" className="entry-error" role="alert">
                  {entryError}
                </p>
              )}
            </>
          ) : (
            <>
              <p>
                Target: {result(step.set)} · Rest: {step.movement.rest}s
              </p>
              <div className="guided-action-bar">
                <button className="primary guided-primary" onClick={start}>
                  {phase === "between" ? "Next exercise" : "Start set"}
                </button>
              </div>
              {phase === "between" &&
                last &&
                last.movement.id !== step.movement.id && (
                  <button
                    className="secondary"
                    onClick={() => addSet(last.movement, false, true)}
                  >
                    One more set of {lookup(last.movement.exerciseId)?.name}
                  </button>
                )}
              {phase === "between" && (
                <button
                  className="secondary"
                  onClick={() =>
                    update((s) => {
                      s.active!.guided = { ...s.active!.guided, phase: "rest" };
                      s.timer =
                        Date.now() +
                        (last?.movement.rest ?? step.movement.rest) * 1000;
                    })
                  }
                >
                  Start rest
                </button>
              )}
            </>
          )}
          <div
            className="guided-set-strip"
            aria-label="Exercise sets"
            ref={setStrip}
          >
            {step.movement.sets.map((set, index) => (
              <button
                key={set.id}
                className={
                  set.id === step.set.id ? "set-chip active" : "set-chip"
                }
                aria-label={
                  (set.done ? "Edit set " : "Go to set ") + (index + 1)
                }
                aria-current={set.id === step.set.id ? "step" : undefined}
                disabled={correcting}
                onClick={() => visit(set)}
              >
                <strong>
                  {set.done ? "✓ " : set.skipped ? "— " : ""}Set {index + 1}
                </strong>
                <span>{set.type === "warmup" ? "Warm-up" : result(set)}</span>
              </button>
            ))}
          </div>
          {manager(step.movement)}
          <details className="workout-actions">
            <summary>Workout actions</summary>
            <div className="guided-quick-actions">
              <button
                className="secondary"
                disabled={correcting}
                onClick={() => addSet(step.movement, true)}
              >
                Add warm-up set
              </button>
              <button
                className="secondary"
                disabled={correcting}
                onClick={addExercise}
              >
                Add exercise
              </button>
              <button className="ghost" disabled={correcting} onClick={skip}>
                Skip exercise
              </button>
              {doneCount > 0 && (
                <button
                  className="ghost"
                  disabled={correcting}
                  onClick={finish}
                >
                  Finish workout early
                </button>
              )}
            </div>
            <label className="field">
              Set type
              <select
                aria-label="Set type"
                value={step.set.type}
                onChange={(ev) =>
                  change((active) => {
                    const target = active.movements
                      .flatMap((m) => m.sets)
                      .find((set) => set.id === step.set.id);
                    if (target) target.type = ev.target.value as SetLog["type"];
                  })
                }
              >
                <option value="working">Working set</option>
                <option value="warmup">Warm-up</option>
                <option value="drop">Drop set</option>
                <option value="failure">Failure set</option>
              </select>
            </label>
            <label className="field">
              Rest between sets (seconds)
              <input
                aria-label="Rest between sets (seconds)"
                type="number"
                inputMode="numeric"
                min="0"
                max="3600"
                value={step.movement.rest}
                onChange={(ev) =>
                  change((active) => {
                    const movement = active.movements.find(
                      (m) => m.id === step.movement.id,
                    );
                    if (movement)
                      movement.rest = Math.max(
                        0,
                        Math.min(3600, Number(ev.target.value) || 0),
                      );
                  })
                }
              />
            </label>
            <label className="field">
              Exercise note
              <textarea
                aria-label="Exercise note"
                placeholder="Seat setting, grip, how it felt…"
                value={step.movement.notes}
                onChange={(ev) =>
                  change((active) => {
                    const movement = active.movements.find(
                      (m) => m.id === step.movement.id,
                    );
                    if (movement) movement.notes = ev.target.value;
                  })
                }
              />
            </label>
          </details>
          {(phase === "intro" || phase === "between") && (
            <>
              {last && (
                <div className="guided-results">
                  <strong>
                    {lookup(last.movement.exerciseId)?.name} — completed sets
                  </strong>
                  {last.movement.sets.map(
                    (s, i) =>
                      s.done && (
                        <p key={s.id}>
                          Set {i + 1}:{" "}
                          {result(s, lookup(last.movement.exerciseId))}
                        </p>
                      ),
                  )}
                </div>
              )}
              {e.images[0] && (
                <ExercisePhoto
                  className="guided-image"
                  src={`exercises/${e.images[0]}`}
                  alt={`${e.name} setup`}
                />
              )}
              <p>{e.cues[0] ?? e.instructions[0]}</p>
            </>
          )}
          <details>
            <summary>Technique & notes</summary>
            <ol>
              {e.instructions.map((text, i) => (
                <li key={i}>{text}</li>
              ))}
            </ol>
            {e.mistakes.length > 0 && (
              <p>Watch for: {e.mistakes.join(" · ")}</p>
            )}
            {[
              step.movement.notes,
              state.exerciseNotes[e.id],
              state.setupNotes[e.id],
            ]
              .filter(Boolean)
              .map((text, i) => (
                <p key={i}>{text}</p>
              ))}
          </details>
          {step.movement.notes && (
            <details>
              <summary>Targets & progression</summary>
              <p>{step.movement.notes}</p>
            </details>
          )}
          <details className="guided-last">
            <summary>Last time</summary>
            {previous && phase === "entry" && (
              <button
                className="secondary"
                onClick={() => {
                  const source = previous.sets[step.index]?.done
                    ? previous.sets[step.index]
                    : [...previous.sets].reverse().find((set) => set.done);
                  if (!source) return;
                  update((s) => {
                    const active = s.active;
                    if (!active) return;
                    const target = active.movements
                      .flatMap((m) => m.sets)
                      .find((set) => set.id === step.set.id);
                    if (!target) return;
                    recordWorkoutAction(s, "Use last session values");
                    Object.assign(target, {
                      weight: source.weight,
                      reps: source.reps,
                      seconds: source.seconds,
                      distance: source.distance,
                      needsLoad: false,
                    });
                    if (active.guided) delete active.guided.draft;
                    if (active.deferredInputs)
                      delete active.deferredInputs[target.id];
                  });
                }}
              >
                Use last session values
              </button>
            )}
            {previous ? (
              previous.sets.map(
                (s, i) =>
                  s.done && (
                    <span key={s.id}>
                      Set {i + 1}: {result(s)} · {s.type}
                    </span>
                  ),
              )
            ) : (
              <p>First session — start with your plan’s targets.</p>
            )}
          </details>
          {!resting && !correcting && (
            <>
              <button
                className="secondary busy-toggle"
                onClick={() => setBusy(!busy)}
              >
                Equipment busy
              </button>
              {busy && (
                <div
                  className="guided-results"
                  aria-label="Equipment busy options"
                >
                  <p>Continue elsewhere, or review a compatible replacement.</p>
                  {w.movements.some(
                    (m) =>
                      m.id !== step.movement.id &&
                      (w.setOrder !== "circuit" ||
                        !step.movement.superset ||
                        m.superset !== step.movement.superset) &&
                      m.sets.some((s) => !s.done && !s.skipped),
                  ) ? (
                    <button
                      className="secondary"
                      onClick={() => {
                        update((s) => {
                          if (s.active && postpone(s.active, step.movement.id))
                            s.timer = null;
                        });
                        setBusy(false);
                        notify(
                          "Moved to the end of this workout. Your saved plan is unchanged.",
                        );
                      }}
                    >
                      Do this later
                    </button>
                  ) : (
                    <p>
                      No other exercises remain. Find an alternative or use
                      Overview to adjust the workout.
                    </p>
                  )}
                  <button
                    className="secondary"
                    onClick={() => alternative(step.movement)}
                  >
                    Find an alternative
                  </button>
                </div>
              )}
            </>
          )}
        </>
      ) : (
        <p>Open Overview to add an exercise.</p>
      )}
      {!paused && (
        <details className="workout-exercises">
          <summary>Workout exercises</summary>
          {w.movements.map((movement) => {
            const pending =
              movement.sets.find((set) => !set.done && !set.skipped) ??
              movement.sets.find((set) => !set.done);
            const name = lookup(movement.exerciseId)?.name ?? "Exercise";
            return (
              <div className="workout-exercise-row" key={movement.id}>
                <div>
                  <strong>{name}</strong>
                  <span>
                    {movement.sets.filter((set) => set.done).length} /{" "}
                    {movement.sets.length} sets
                  </span>
                </div>
                <button
                  className="secondary"
                  disabled={correcting}
                  aria-label={
                    pending ? "Continue " + name : "Extra set for " + name
                  }
                  onClick={() =>
                    pending ? visit(pending) : addSet(movement, false, true)
                  }
                >
                  {pending ? "Continue" : "+ Set"}
                </button>
              </div>
            );
          })}
          <button
            className="secondary"
            disabled={correcting}
            onClick={addExercise}
          >
            Add exercise to workout
          </button>
        </details>
      )}
      {!paused && (
        <details className="workout-settings">
          <summary>Workout settings</summary>
          <label className="field">
            Exercise order
            <select
              aria-label="Exercise order"
              value={w.setOrder ?? "exercise"}
              onChange={(ev) =>
                update((s) => {
                  if (!s.active) return;
                  if (s.active.setOrder === ev.target.value) return;
                  recordWorkoutAction(s, "Change exercise order");
                  s.active.setOrder = ev.target.value as "exercise" | "circuit";
                })
              }
            >
              <option value="exercise">All sets of one exercise</option>
              <option value="circuit">Alternate circuit exercises</option>
            </select>
          </label>
          <button
            className="secondary"
            onClick={async () => {
              notify(await enableRestAlerts());
            }}
          >
            Enable sound & phone notifications
          </button>
          <p className="hint">
            Sound plays while the app is running. Phone notifications may be
            delayed in the background. For reliable alerts with the browser
            closed or phone locked, use your phone timer.
          </p>
          <label className="toggle-row">
            <input
              type="checkbox"
              checked={!!state.settings.keepAwake}
              onChange={(ev) =>
                update((s) => {
                  s.settings.keepAwake = ev.target.checked;
                })
              }
            />
            Keep screen awake
          </label>
          {wakeStatus && (
            <p role="status" className="hint">
              {wakeStatus}
            </p>
          )}
          {e?.mode === "strength" && (
            <label className="field">
              Weight increment ({loadUnit(state.settings.weight, e)})
              <input
                aria-label="Weight increment"
                type="number"
                inputMode="decimal"
                min="0.001"
                max="1000000"
                step="any"
                value={incrementText ?? number(weightIncrement(state, e))}
                onBlur={() => setIncrementText(null)}
                onChange={(ev) => {
                  setIncrementText(ev.target.value);
                  const value = Number(ev.target.value);
                  if (value > 0 && value <= 1000000)
                    update((s) => saveIncrement(s, e, value));
                }}
              />
            </label>
          )}
        </details>
      )}
      {w.notes && (
        <details>
          <summary>Day & recovery notes</summary>
          <p>{w.notes}</p>
        </details>
      )}
      {!paused && allSets.some((s) => s.done) && (
        <details className="guided-results">
          <summary>Back to a previous exercise / correct a set</summary>
          <p className="hint">
            Choose a saved set, then save or cancel your correction. Your place
            in the workout is kept.
          </p>
          {w.movements.map((m) =>
            m.sets.map(
              (set, index) =>
                set.done && (
                  <button
                    key={set.id}
                    className="secondary"
                    disabled={correcting}
                    onClick={() => visit(set)}
                  >
                    Edit {lookup(m.exerciseId)?.name} - set {index + 1}
                  </button>
                ),
            ),
          )}
        </details>
      )}
      {!paused &&
        !correcting &&
        g?.undo &&
        (!w.undoActions?.length ||
          w.undoActions.at(-1)?.set?.setId === g.undo.setId) && (
          <button
            className="secondary"
            onClick={() => {
              update((s) => undoLastSet(s));
              setEntryError("");
              notify("Set restored. Your other entries are kept.");
            }}
          >
            {g.undo.kind === "skip" ? "Undo skipped set" : "Undo completed set"}
          </button>
        )}
    </section>
  );
}
