import { ExercisePhoto } from "./components";
import { useState } from "react";
import type {
  State,
  Exercise,
  Movement,
  BuddyDraft,
  BuddyPreferences,
} from "./types";
import {
  buildDraft,
  chooseSuggestion,
  defaultBuddyPreferences,
  eligibility,
  estimateMinutes,
  lastCompleted,
  starterMovement,
  tagsFor,
} from "./buddy.mjs";
import { BUDDY_MUSCLES, displayLoad, loadUnit } from "./domain.mjs";
import "./buddy.css";

type Props = {
  state: State;
  exercises: Exercise[];
  update: (fn: (s: State) => void) => void;
  notify: (message: string) => void;
  guide: (e: Exercise) => void;
  pick: (fn: (e: Exercise) => void) => void;
  editor: (
    m: Movement[],
    fn: (edit: (m: Movement[]) => void) => void,
    context: (m: Movement) => React.ReactNode,
  ) => React.ReactNode;
  accept: (
    action: "plan" | "day" | "start" | "update",
    draft: BuddyDraft,
    dayId: string,
    targetPlanId: string,
  ) => void;
  initialSetup?: boolean;
};
export function WorkoutBuddy({
  state,
  exercises,
  update,
  notify,
  guide,
  pick,
  editor,
  accept,
  initialSetup,
}: Props) {
  const prefs = state.buddy?.preferences ?? defaultBuddyPreferences();
  const draft = state.buddy?.draft;
  const [review, setReview] = useState(!!draft && !initialSetup);
  const [selectedDay, setSelectedDay] = useState(draft?.days[0]?.id ?? "");
  const [targetPlan, setTargetPlan] = useState(state.plans[0]?.id ?? "");
  const [avoidSearch, setAvoidSearch] = useState("");
  const lookup = (id: string) => exercises.find((e) => e.id === id);
  const chosen =
    draft?.days.find((d) => d.id === selectedDay) ?? draft?.days[0];
  const preferences = (change: Partial<BuddyPreferences>) =>
    update((s) => {
      s.buddy = {
        ...s.buddy,
        preferences: {
          ...(s.buddy?.preferences ?? defaultBuddyPreferences()),
          ...change,
        },
      };
    });
  const editDraft = (fn: (draft: BuddyDraft) => void) =>
    update((s) => {
      if (s.buddy?.draft) fn(s.buddy.draft);
    });
  const muscleChoiceMissing =
    prefs.mode === "create" &&
    prefs.output === "routine" &&
    prefs.focus === "muscles" &&
    !prefs.selectedMuscles?.length;
  const canSurprise = prefs.mode === "create" && prefs.output === "routine";
  const generate = (surprise = false) => {
    if (muscleChoiceMissing) return;
    const result = buildDraft(state, exercises, prefs, { surprise });
    update((s) => {
      s.buddy = { preferences: { ...prefs }, draft: result };
    });
    setSelectedDay(result.days[0]?.id ?? "");
    setReview(true);
    window.scrollTo(0, 0);
  };
  const choose = (e: Exercise) => {
    if (!draft) return;
    const eligible = eligibility(e, prefs, state);
    if (!eligible.ok) {
      notify(eligible.reason);
      return;
    }
    const result = chooseSuggestion(draft, e);
    update((s) => {
      if (s.buddy) s.buddy.draft = result;
    });
    setSelectedDay(result.days[0].id);
  };
  const buttonChoices = <T extends string | number>(
    label: string,
    values: T[],
    value: T,
    change: (v: T) => void,
  ) => (
    <div className="buddy-choice-group" role="group" aria-label={label}>
      {values.map((v) => (
        <button
          key={v}
          className={`chip ${value === v ? "selected" : ""}`}
          aria-pressed={value === v}
          onClick={() => change(v)}
        >
          {v}
        </button>
      ))}
    </div>
  );
  const changeSource = (value: string) => {
    const [planId, dayId] = value.split("/");
    preferences({
      sourcePlanId: planId,
      sourceDayId: dayId,
      sourceScope: "plan",
      sourceMovementId: undefined,
    });
  };
  const confirmed = state.equipment.filter(
    (e) => e.confirmed && !e.unavailable,
  );
  const allDays = state.plans.flatMap((p) =>
    p.days
      .filter((d) => !d.restDay && d.movements.length)
      .map((d) => ({ plan: p, day: d })),
  );
  const muscles = [
    ...new Set(
      exercises
        .filter((e) => tagsFor(e).pattern)
        .flatMap((e) => e.primaryMuscles),
    ),
  ].sort();
  const canAccept =
    !!draft?.days.length &&
    draft.days.every(
      (d) =>
        d.movements.length > 0 &&
        d.movements.every(
          (m) =>
            !!lookup(m.exerciseId) &&
            eligibility(
              lookup(m.exerciseId)!,
              prefs,
              state,
              !(draft.source && !draft.source.movementId),
            ).ok &&
            m.sets.length > 0,
        ),
    );
  const acceptAction = (action: "plan" | "day" | "start" | "update") => {
    if (!draft || !chosen || !canAccept) {
      notify(
        "Review the equipment, exclusions, and empty exercises before accepting this draft.",
      );
      return;
    }
    accept(action, draft, chosen.id, targetPlan);
  };
  const renderContext = (m: Movement) => {
    if (!draft || !chosen) return null;
    const e = lookup(m.exerciseId);
    if (!e) return null;
    const previous = lastCompleted(state, e.id);
    const valid = eligibility(
      e,
      prefs,
      state,
      !(draft.source && !draft.source.movementId),
    );
    return (
      <div className="buddy-movement" key={m.id}>
        <div className="buddy-context">
          <p>{draft.reasons[m.id] ?? "Added during your draft review."}</p>
          {!valid.ok && <p role="status">{valid.reason}</p>}
          {m.sets.some((t) => t.needsLoad) && (
            <p>
              Load not chosen. Enter a load below, or choose zero explicitly for
              no added load.
            </p>
          )}
          {previous && (
            <>
              <p>
                Last completed loads:{" "}
                {previous.sets
                  .filter((t) => t.done && t.type !== "warmup")
                  .map(
                    (t) =>
                      `${Number(displayLoad(t.weight, state.settings.weight, e).toFixed(2))} ${loadUnit(state.settings.weight, e)} × ${t.reps}`,
                  )
                  .join(" · ")}
              </p>
              <button
                className="secondary"
                onClick={() =>
                  editDraft((d) => {
                    const target = d.days
                      .find((x) => x.id === chosen.id)
                      ?.movements.find((x) => x.id === m.id);
                    if (!target) return;
                    const recorded = previous.sets.filter(
                      (t) => t.done && t.type !== "warmup",
                    );
                    target.sets.forEach((t, i) => {
                      const prior = recorded[i] ?? recorded.at(-1);
                      if (prior) {
                        t.weight = prior.weight;
                        t.needsLoad = false;
                      }
                    });
                  })
                }
              >
                Use last load for {e.name}
              </button>
            </>
          )}
        </div>
      </div>
    );
  };
  return (
    <div className="buddy-page">
      <div className="buddy-bubble">
        <span className="eyebrow">WORKOUT BUDDY</span>
        <h2>Let's work out your next session.</h2>
        <p>Offline, rules-based suggestions.</p>
        <p className="hint">
          Your choices and records stay on this device. Every result is an
          editable draft.
        </p>
      </div>
      {review && draft ? (
        <>
          <div className="buddy-bubble buddy-response">
            <h3>Your draft is ready for review</h3>
            {canSurprise && (
              <button
                className="secondary"
                disabled={muscleChoiceMissing}
                onClick={() => generate(true)}
              >
                Surprise me again
              </button>
            )}
            <button className="secondary" onClick={() => setReview(false)}>
              Change choices
            </button>
            <button
              className="ghost"
              onClick={() => {
                update((s) => {
                  if (s.buddy) delete s.buddy.draft;
                });
                setReview(false);
              }}
            >
              Discard draft
            </button>
          </div>
          {draft.warnings.length > 0 && (
            <div className="buddy-bubble buddy-warnings" role="status">
              <h3>Requirements to review</h3>
              {draft.warnings.map((w, i) => (
                <p key={i}>{w}</p>
              ))}
              <a className="source-link" href="#equipment">
                Confirm gym equipment
              </a>
            </div>
          )}
          {draft.changes.length > 0 && (
            <details className="buddy-bubble" open>
              <summary>Proposed changes</summary>
              <ul>
                {draft.changes.map((change, i) => (
                  <li key={i}>{change}</li>
                ))}
              </ul>
            </details>
          )}
          {draft.suggestions.length > 0 && (
            <div className="buddy-suggestions">
              {draft.suggestions.map((suggestion) => {
                const e = lookup(suggestion.exerciseId);
                if (!e) return null;
                return (
                  <article className="panel buddy-option" key={e.id}>
                    {e.images[0] && (
                      <ExercisePhoto
                        loading="lazy"
                        src={`exercises/${e.images[0]}`}
                        alt={`${e.name} setup`}
                      />
                    )}
                    <h3>{e.name}</h3>
                    <span className="tag">
                      {suggestion.newToYou
                        ? "New to your history"
                        : "Previously logged"}
                    </span>
                    <p>{suggestion.reason}</p>
                    <p className="hint">
                      Equipment:{" "}
                      {e.required
                        .map(
                          (id) =>
                            state.equipment.find((x) => x.id === id)?.name ??
                            id,
                        )
                        .join(" + ") || "Bodyweight"}
                    </p>
                    <div className="actions">
                      <button className="secondary" onClick={() => guide(e)}>
                        Exercise guide
                      </button>
                      <button className="primary" onClick={() => choose(e)}>
                        Choose this exercise
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
          {draft.days.length > 0 && chosen && (
            <>
              <section className="buddy-bubble">
                <label className="field">
                  Draft name
                  <input
                    value={draft.name}
                    onChange={(e) =>
                      editDraft((d) => {
                        d.name = e.target.value;
                      })
                    }
                  />
                </label>
                {draft.days.length > 1 && (
                  <label className="field">
                    Review draft day
                    <select
                      aria-label="Review draft day"
                      value={chosen.id}
                      onChange={(e) => setSelectedDay(e.target.value)}
                    >
                      {draft.days.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                <label className="field">
                  Day name
                  <input
                    value={chosen.name}
                    onChange={(e) =>
                      editDraft((d) => {
                        const day = d.days.find((x) => x.id === chosen.id);
                        if (day) day.name = e.target.value;
                      })
                    }
                  />
                </label>
                <p>
                  <strong>
                    Estimated {estimateMinutes(chosen, lookup)} minutes
                  </strong>{" "}
                  · {prefs.minutes}-minute budget. Includes sets, rest, setup
                  and transitions; actual time varies.
                </p>
                {estimateMinutes(chosen, lookup) > prefs.minutes && (
                  <p className="hint">
                    This draft exceeds the selected budget. Change choices or
                    edit sets before accepting.
                  </p>
                )}
                <label className="field">
                  Draft day notes
                  <textarea
                    value={chosen.notes ?? ""}
                    onChange={(e) =>
                      editDraft((d) => {
                        const day = d.days.find((x) => x.id === chosen.id);
                        if (day) day.notes = e.target.value;
                      })
                    }
                  />
                </label>
              </section>
              {editor(
                chosen.movements,
                (edit) =>
                  editDraft((d) => {
                    const day = d.days.find((x) => x.id === chosen.id);
                    if (day) edit(day.movements);
                  }),
                renderContext,
              )}
              <button
                className="add-exercise"
                onClick={() =>
                  pick((e) => {
                    const result = eligibility(e, prefs, state);
                    if (!result.ok) {
                      notify(result.reason);
                      return;
                    }
                    editDraft((d) => {
                      const day = d.days.find((x) => x.id === chosen.id);
                      if (day) {
                        const m = starterMovement(e);
                        day.movements.push(m);
                        d.reasons[m.id] =
                          "Added by you using eligible equipment and restrictions.";
                      }
                    });
                  })
                }
              >
                Add exercise to draft
              </button>
              <section className="buddy-bubble buddy-accept">
                <h3>Keep this draft?</h3>
                <p>Saved plans and workout history have not changed.</p>
                <div className="actions">
                  <button
                    className="primary"
                    disabled={!canAccept}
                    onClick={() => acceptAction("start")}
                  >
                    Start this routine
                  </button>
                  <button
                    className="secondary"
                    disabled={!canAccept}
                    onClick={() => acceptAction("plan")}
                  >
                    Save as new plan
                  </button>
                </div>
                {state.plans.length > 0 && (
                  <>
                    <label className="field">
                      Save into plan
                      <select
                        aria-label="Save into plan"
                        value={targetPlan || state.plans[0].id}
                        onChange={(e) => setTargetPlan(e.target.value)}
                      >
                        {state.plans.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <button
                      className="secondary"
                      disabled={!canAccept}
                      onClick={() => acceptAction("day")}
                    >
                      Save as new day
                    </button>
                  </>
                )}
                {draft.source && (
                  <button
                    className="secondary"
                    disabled={!canAccept}
                    onClick={() => acceptAction("update")}
                  >
                    {draft.source.movementId
                      ? "Review exercise replacement"
                      : "Review saved day update"}
                  </button>
                )}
                {!canAccept && (
                  <p>
                    Resolve empty days or incompatible exercises before
                    accepting. Unchosen loads can be selected during the guided
                    workout.
                  </p>
                )}
              </section>
            </>
          )}
        </>
      ) : (
        <>
          <div className="buddy-bubble buddy-question">
            <h3>What would you like help with?</h3>
            <div className="buddy-choice-group">
              {(
                [
                  ["suggest", "Suggest an exercise"],
                  ["adapt", "Adapt my workout"],
                  ["create", "Create from scratch"],
                ] as const
              ).map(([mode, label]) => (
                <button
                  key={mode}
                  className={`chip ${prefs.mode === mode ? "selected" : ""}`}
                  aria-pressed={prefs.mode === mode}
                  onClick={() => preferences({ mode })}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="buddy-bubble">
            <h3>
              {prefs.mode === "suggest"
                ? "What are we exploring?"
                : prefs.mode === "adapt"
                  ? "Which day shall we adapt?"
                  : "Tell me about the routine you want."}
            </h3>
            {prefs.mode === "suggest" ? (
              <>
                <label className="field">
                  Exercise to replace
                  <select
                    aria-label="Exercise to replace"
                    value={prefs.exerciseId ?? ""}
                    onChange={(e) =>
                      preferences({
                        exerciseId: e.target.value || undefined,
                        sourcePlanId: undefined,
                        sourceDayId: undefined,
                        sourceMovementId: undefined,
                        sourceScope: undefined,
                      })
                    }
                  >
                    <option value="">Explore a muscle instead</option>
                    {exercises.map((e) => (
                      <option value={e.id} key={e.id}>
                        {e.name}
                      </option>
                    ))}
                  </select>
                </label>
                {!prefs.exerciseId && (
                  <label className="field">
                    Muscle to explore
                    <select
                      aria-label="Muscle to explore"
                      value={prefs.muscle ?? "chest"}
                      onChange={(e) => preferences({ muscle: e.target.value })}
                    >
                      {muscles.map((m) => (
                        <option key={m}>{m}</option>
                      ))}
                    </select>
                  </label>
                )}
              </>
            ) : prefs.mode === "adapt" ? (
              <label className="field">
                Saved workout day
                <select
                  aria-label="Saved workout day"
                  value={
                    prefs.sourcePlanId && prefs.sourceDayId
                      ? `${prefs.sourcePlanId}/${prefs.sourceDayId}`
                      : ""
                  }
                  onChange={(e) => changeSource(e.target.value)}
                >
                  <option value="">Choose a training day</option>
                  {allDays.map(({ plan, day }) => (
                    <option key={day.id} value={`${plan.id}/${day.id}`}>
                      {plan.name} / {day.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <>
                {buttonChoices(
                  "Draft type",
                  ["routine", "plan"] as const,
                  prefs.output,
                  (output) => preferences({ output }),
                )}
                {prefs.output === "plan" ? (
                  <>
                    <p>Training days per cycle</p>
                    {buttonChoices(
                      "Training frequency",
                      [2, 3, 4, 5] as const,
                      prefs.frequency,
                      (frequency) => preferences({ frequency }),
                    )}
                    <p className="hint">
                      2–3: full body; 4: upper/lower; 5:
                      upper/lower/push/pull/legs. Rest whenever needed.
                    </p>
                  </>
                ) : (
                  <label className="field">
                    Workout focus
                    <select
                      aria-label="Workout focus"
                      value={prefs.focus}
                      onChange={(e) =>
                        preferences({
                          focus: e.target.value as BuddyPreferences["focus"],
                        })
                      }
                    >
                      {[
                        "full-body",
                        "upper",
                        "lower",
                        "push",
                        "pull",
                        "legs",
                        "muscles",
                      ].map((f) => (
                        <option key={f} value={f}>
                          {f === "muscles" ? "Choose muscle groups" : f}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
              </>
            )}
            {canSurprise && prefs.focus === "muscles" && (
              <fieldset className="buddy-muscles">
                <legend>Muscle groups for today</legend>
                <p>
                  Choose one or more. Exercises will target these as primary
                  muscles.
                </p>
                <div className="buddy-checks">
                  {BUDDY_MUSCLES.map((muscle) => (
                    <label key={muscle}>
                      <input
                        type="checkbox"
                        checked={
                          prefs.selectedMuscles?.includes(muscle) ?? false
                        }
                        onChange={(e) =>
                          preferences({
                            selectedMuscles: e.target.checked
                              ? [...(prefs.selectedMuscles ?? []), muscle]
                              : prefs.selectedMuscles?.filter(
                                  (m) => m !== muscle,
                                ),
                          })
                        }
                      />
                      {muscle}
                    </label>
                  ))}
                </div>
                {muscleChoiceMissing && (
                  <p className="hint">
                    Choose at least one muscle group to generate a routine.
                  </p>
                )}
              </fieldset>
            )}
            <p>Experience level</p>
            {buttonChoices(
              "Experience level",
              ["beginner", "intermediate", "advanced"] as const,
              prefs.experience,
              (experience) => preferences({ experience }),
            )}
            {prefs.mode !== "suggest" && (
              <>
                <p>Session budget in minutes</p>
                {buttonChoices(
                  "Session budget",
                  [20, 40, 60] as const,
                  prefs.minutes,
                  (minutes) => preferences({ minutes }),
                )}
              </>
            )}
          </div>
          <div className="buddy-bubble">
            <h3>Which equipment can you use this session?</h3>
            <p>
              Bodyweight is included. Only confirmed, available equipment can be
              selected.
            </p>
            {confirmed.length ? (
              <details>
                <summary>
                  Choose equipment (
                  {
                    (prefs.equipmentIds ?? confirmed.map((e) => e.id)).filter(
                      (id) => confirmed.some((e) => e.id === id),
                    ).length
                  }{" "}
                  selected)
                </summary>
                <div className="buddy-checks">
                  {confirmed.map((e) => (
                    <label key={e.id}>
                      <input
                        type="checkbox"
                        checked={(
                          prefs.equipmentIds ?? confirmed.map((e) => e.id)
                        ).includes(e.id)}
                        onChange={(ev) => {
                          const ids =
                            prefs.equipmentIds ?? confirmed.map((e) => e.id);
                          preferences({
                            equipmentIds: ev.target.checked
                              ? [...ids, e.id]
                              : ids.filter((id) => id !== e.id),
                          });
                        }}
                      />
                      {e.name}
                    </label>
                  ))}
                </div>
              </details>
            ) : (
              <p>
                No gym equipment is confirmed yet. Bodyweight options are
                available.
              </p>
            )}
            <a className="source-link" href="#equipment">
              Confirm gym equipment
            </a>
          </div>
          <div className="buddy-bubble">
            <h3>Any restrictions for this session?</h3>
            <p>
              Review these choices today. Past notes do not tell me whether you
              are ready.
            </p>
            <div className="buddy-checks">
              <label>
                <input
                  type="checkbox"
                  checked={prefs.avoidOverhead}
                  onChange={(e) =>
                    preferences({ avoidOverhead: e.target.checked })
                  }
                />
                Exclude overhead presses
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={prefs.avoidGrip}
                  onChange={(e) => preferences({ avoidGrip: e.target.checked })}
                />
                Exclude grip-heavy exercises
              </label>
            </div>
            <details>
              <summary>
                Exclude particular exercises ({prefs.exclusions.length})
              </summary>
              <label className="field">
                Avoid exercise search
                <input
                  type="search"
                  value={avoidSearch}
                  onChange={(e) => setAvoidSearch(e.target.value)}
                  placeholder="Search exercises to exclude"
                />
              </label>
              <div className="buddy-checks">
                {exercises
                  .filter(
                    (e) =>
                      prefs.exclusions.includes(e.id) ||
                      (avoidSearch.length > 1 &&
                        e.name
                          .toLowerCase()
                          .includes(avoidSearch.toLowerCase())),
                  )
                  .slice(0, 20)
                  .map((e) => (
                    <label key={e.id}>
                      <input
                        type="checkbox"
                        checked={prefs.exclusions.includes(e.id)}
                        onChange={(ev) =>
                          preferences({
                            exclusions: ev.target.checked
                              ? [...prefs.exclusions, e.id]
                              : prefs.exclusions.filter((id) => id !== e.id),
                          })
                        }
                      />
                      {e.name}
                    </label>
                  ))}
              </div>
            </details>
          </div>
          <button
            className="primary buddy-generate"
            disabled={muscleChoiceMissing}
            onClick={() => generate()}
          >
            {prefs.mode === "suggest"
              ? "Confirm choices & suggest"
              : "Confirm choices & draft"}
          </button>
          {canSurprise && (
            <>
              <button
                className="secondary buddy-generate"
                disabled={muscleChoiceMissing}
                onClick={() => generate(true)}
              >
                Surprise me
              </button>
              <p className="hint">
                Mix familiar exercises with new choices using your selected
                equipment, workout focus and time budget. Review the draft
                before starting.
              </p>
            </>
          )}
          {draft && (
            <button className="secondary" onClick={() => setReview(true)}>
              Return to latest draft
            </button>
          )}
        </>
      )}
    </div>
  );
}
