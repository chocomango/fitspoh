import { useEffect } from "react";
import type { Exercise, State, Workout, SetLog } from "./types";
import { currentStep, workoutQueue } from "./guided";
import {
  toDisplayDistance,
  toStoredDistance,
  displayLoad,
  storedLoad,
  loadUnit,
} from "./domain.mjs";
import { MovementDemo } from "./components";

type Props = {
  state: State;
  now: number;
  lookup: (id: string) => Exercise | undefined;
  update: (fn: (s: State) => void) => void;
  notify: (message: string) => void;
  finish: () => void;
};
const number = (n: number) => Number(n.toFixed(2));
export function GuidedWorkout({
  state,
  now,
  lookup,
  update,
  notify,
  finish,
}: Props) {
  const w = state.active!;
  const step = currentStep(w);
  const g = w.guided;
  const phase = g?.phase ?? "intro";
  const e = step && lookup(step.movement.exerciseId);
  const last = workoutQueue(w.movements).find((x) => x.set.id === g?.lastSetId);
  const previous =
    e &&
    [...state.workouts]
      .sort((a, b) => b.started.localeCompare(a.started))
      .flatMap((x) => x.movements)
      .find((m) => m.exerciseId === e.id && m.sets.some((s) => s.done));
  const summary = !step || phase === "summary";
  const resting = phase === "rest";
  const remaining = Math.max(0, Math.ceil(((state.timer ?? now) - now) / 1000));
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
  const change = (fn: (active: Workout) => void) =>
    update((s) => {
      if (s.active) fn(s.active);
    });
  const start = () =>
    update((s) => {
      if (s.active)
        s.active.guided = {
          ...s.active.guided,
          setId: step?.set.id,
          phase: "entry",
        };
      s.timer = null;
    });
  const result = (set: SetLog, metadata = e) =>
    metadata?.mode === "strength"
      ? `${number(displayLoad(set.weight, state.settings.weight, metadata))} ${loadUnit(state.settings.weight, metadata)} × ${set.reps} reps`
      : `${set.seconds}s${metadata?.mode === "cardio" ? ` · ${number(toDisplayDistance(set.distance, state.settings.distance))} ${state.settings.distance}` : ""}`;
  const complete = () => {
    if (!step || !e) return;
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
      current.set.done = true;
      current.set.skipped = false;
      const next = currentStep({ ...active, guided: undefined });
      if (next) {
        const prior = [...next.movement.sets].reverse().find((s) => s.done);
        if (prior) next.set.weight = prior.weight;
      }
      // A grouped round ends before the index advances or the group changes.
      const roundEnd =
        !current.movement.superset ||
        !next ||
        next.movement.superset !== current.movement.superset ||
        next.index !== current.index;
      const sameExercise = next?.movement.id === current.movement.id;
      const rest =
        !!next && roundEnd && (!!current.movement.superset || sameExercise);
      active.guided = {
        setId: next?.set.id,
        lastSetId: current.set.id,
        phase: !next ? "summary" : rest ? "rest" : "between",
      };
      s.timer = rest ? Date.now() + current.movement.rest * 1000 : null;
    });
  };
  const skip = () =>
    update((s) => {
      const active = s.active!;
      const current = currentStep(active);
      if (!current) return;
      current.movement.sets
        .filter((x) => !x.done)
        .forEach((x) => {
          x.skipped = true;
        });
      const next = currentStep({ ...active, guided: undefined });
      active.guided = {
        setId: next?.set.id,
        phase: next ? "intro" : "summary",
      };
      s.timer = null;
    });
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
    return (
      <label className="field" key={key}>
        {label}
        <input
          type="number"
          inputMode="decimal"
          min="0"
          max={max}
          step={key === "reps" || key === "seconds" ? "1" : "0.1"}
          aria-label={label}
          value={
            g?.draft?.setId === step.set.id
              ? (g.draft.values[key] ?? number(value))
              : number(value)
          }
          onChange={(ev) => {
            const text = ev.target.value;
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
                  values: {
                    ...(active.guided?.draft?.setId === step.set.id
                      ? active.guided.draft.values
                      : {}),
                    [key]: text,
                  },
                },
              };
              target[key] =
                key === "weight"
                  ? storedLoad(raw, state.settings.weight, e)
                  : key === "distance"
                    ? toStoredDistance(raw, state.settings.distance)
                    : raw;
              if (key === "effort" && state.settings.effort !== "off")
                target.effortKind = state.settings.effort;
            });
          }}
        />
      </label>
    );
  };
  return (
    <section className="guided-workout panel" aria-label="Guided workout">
      <div className="section-title">
        <strong>{w.name}</strong>
        <button
          className="secondary"
          onClick={() =>
            change((active) => {
              active.guided = { ...active.guided, phase, overview: true };
              delete active.guided.draft;
            })
          }
        >
          Overview
        </button>
      </div>
      {w.notes && (
        <details>
          <summary>Day & recovery notes</summary>
          <p>{w.notes}</p>
        </details>
      )}
      {summary ? (
        <>
          <h2>Workout review</h2>
          <p>
            {w.movements.flatMap((m) => m.sets).filter((s) => s.done).length}{" "}
            completed sets
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
          <button className="primary guided-primary" onClick={finish}>
            Finish workout
          </button>
        </>
      ) : e && step ? (
        <>
          <p className="eyebrow">
            Exercise {w.movements.indexOf(step.movement) + 1} of{" "}
            {w.movements.length} · Set {step.index + 1} of{" "}
            {step.movement.sets.length}
            {step.movement.superset
              ? ` · Circuit ${step.movement.superset}`
              : ""}
          </p>
          <h2>{e.name}</h2>
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
                <img
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
            {e.animation && <MovementDemo kind={e.animation} />}
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
            <details open={phase === "intro"}>
              <summary>Targets & progression</summary>
              <p>{step.movement.notes}</p>
            </details>
          )}
          <div className="guided-last">
            <strong>Last time</strong>
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
          </div>
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
              <button className="primary guided-primary" onClick={start}>
                {remaining ? "Skip rest" : "Start next set"}
              </button>
            </div>
          ) : phase === "entry" ? (
            <>
              <p>
                {step.set.type} set
                {e.mode === "strength"
                  ? ` · Plan target: ${step.movement.repMin}–${step.movement.repMax} reps`
                  : ""}
              </p>
              {e.mode === "strength" && (
                <p>
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
              <button className="primary guided-primary" onClick={complete}>
                {(() => {
                  const queue = workoutQueue(w.movements).filter(
                    (x) => !x.set.done && !x.set.skipped,
                  );
                  const next = queue.find((x) => x.set.id !== step.set.id);
                  return next &&
                    (next.movement.id === step.movement.id ||
                      (step.movement.superset &&
                        next.movement.superset === step.movement.superset &&
                        next.index !== step.index))
                    ? "Complete set & start rest"
                    : "Complete set";
                })()}
              </button>
            </>
          ) : (
            <>
              <p>
                Target: {result(step.set)} · Rest: {step.movement.rest}s
              </p>
              <button className="primary guided-primary" onClick={start}>
                {phase === "between" ? "Next exercise" : "Start set"}
              </button>
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
          <button className="ghost" onClick={skip}>
            Skip exercise
          </button>
        </>
      ) : (
        <p>Open Overview to add an exercise.</p>
      )}
    </section>
  );
}
