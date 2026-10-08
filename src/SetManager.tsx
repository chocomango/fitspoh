import { useRef, useState } from "react";
import type { Movement, SetLog } from "./types";

type Props = {
  movement: Movement;
  name: string;
  selectedId?: string;
  disabled: boolean;
  result: (set: SetLog) => string;
  visit: (set: SetLog) => void;
  restart: (setId: string) => void;
  insert: (
    setId: string,
    placement: "before" | "after",
    type: "warmup" | "working",
  ) => void;
  remove: (setId: string) => void;
  move: (setId: string, beforeSetId?: string) => void;
};

export function SetManager({
  movement,
  name,
  selectedId,
  disabled,
  result,
  visit,
  restart,
  insert,
  remove,
  move,
}: Props) {
  const [dragged, setDragged] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const [after, setAfter] = useState(false);
  const dragging = useRef<string | null>(null);
  const destination = useRef<string | undefined | null>(null);
  const container = useRef<HTMLDetailsElement>(null);
  const reset = () => {
    dragging.current = null;
    destination.current = null;
    setDragged(null);
    setOver(null);
    setAfter(false);
  };
  const moveOne = (id: string, direction: number) => {
    const index = movement.sets.findIndex((set) => set.id === id);
    if (
      disabled ||
      index < 0 ||
      index + direction < 0 ||
      index + direction >= movement.sets.length
    )
      return;
    move(
      id,
      direction < 0
        ? movement.sets[index - 1].id
        : movement.sets[index + 2]?.id,
    );
  };
  const targetAt = (x: number, y: number) => {
    const target = document.elementFromPoint(x, y);
    const row = target?.closest<HTMLElement>("[data-set-id]");
    const id =
      row && container.current?.contains(row)
        ? (row.dataset.setId ?? null)
        : null;
    const rect = row?.getBoundingClientRect();
    const below = !!rect && y > rect.top + rect.height / 2;
    const index = movement.sets.findIndex((set) => set.id === id);
    destination.current = id && below ? movement.sets[index + 1]?.id : id;
    setOver(id);
    setAfter(below);
    if (
      target?.closest("[data-set-end]") &&
      container.current?.contains(target)
    ) {
      destination.current = undefined;
      setOver("end");
    }
  };
  const drop = () => {
    if (
      dragging.current &&
      destination.current !== null &&
      dragging.current !== destination.current
    )
      move(dragging.current, destination.current);
    reset();
  };
  return (
    <details
      className="set-manager"
      ref={container}
      aria-label={`Manage sets for ${name}`}
    >
      <summary>Manage sets</summary>
      <p className="hint">
        Drag a handle to change the order, or use the arrows. Warm-ups added
        from Workout actions go at the beginning.
      </p>
      <div role="list" aria-label={`${name} set order`}>
        {movement.sets.map((set, index) => (
          <div
            role="listitem"
            data-set-id={set.id}
            key={set.id}
            className={`managed-set ${selectedId === set.id ? "selected" : ""} ${dragged === set.id ? "dragging" : ""} ${over === set.id && dragged !== set.id ? (after ? "drop-after" : "drop-target") : ""}`}
            onDragOver={(event) => {
              if (!dragging.current || disabled) return;
              event.preventDefault();
              targetAt(event.clientX, event.clientY);
            }}
            onDrop={(event) => {
              event.preventDefault();
              if (!disabled) drop();
            }}
          >
            <div className="managed-set-head">
              <button
                type="button"
                className="secondary set-drag-handle"
                aria-label={`Drag set ${index + 1}`}
                title="Drag to reorder; arrow keys also work"
                disabled={disabled}
                draggable={!disabled}
                onDragStart={(event) => {
                  dragging.current = set.id;
                  setDragged(set.id);
                  event.dataTransfer.effectAllowed = "move";
                  event.dataTransfer.setData("text/plain", set.id);
                }}
                onDragEnd={reset}
                onPointerDown={(event) => {
                  if (disabled || event.pointerType === "mouse") return;
                  dragging.current = set.id;
                  setDragged(set.id);
                  try {
                    event.currentTarget.setPointerCapture(event.pointerId);
                  } catch {
                    /* Browser may cancel a pointer. */
                  }
                }}
                onPointerMove={(event) => {
                  if (event.pointerType === "mouse" || !dragging.current)
                    return;
                  event.preventDefault();
                  targetAt(event.clientX, event.clientY);
                  if (event.clientY < 100) window.scrollBy(0, -16);
                  else if (event.clientY > innerHeight - 160)
                    window.scrollBy(0, 16);
                }}
                onPointerUp={(event) => {
                  if (event.pointerType === "mouse" || !dragging.current)
                    return;
                  targetAt(event.clientX, event.clientY);
                  drop();
                }}
                onPointerCancel={(event) => {
                  // Native mouse dragging cancels its pointer before drop.
                  if (event.pointerType !== "mouse") reset();
                }}
                onKeyDown={(event) => {
                  if (event.key === "ArrowUp" || event.key === "ArrowDown") {
                    event.preventDefault();
                    moveOne(set.id, event.key === "ArrowUp" ? -1 : 1);
                  } else if (event.key === "Escape") reset();
                }}
              >
                ⠿
              </button>
              <button
                type="button"
                className="text-button managed-set-result"
                disabled={disabled}
                onClick={() => visit(set)}
                aria-label={`${set.done ? "Edit" : "Go to"} managed set ${index + 1}`}
              >
                <strong>
                  Set {index + 1} ·{" "}
                  {set.type === "warmup" ? "Warm-up" : set.type}
                </strong>
                <span>
                  {result(set)} ·{" "}
                  {set.done ? "Completed" : set.skipped ? "Skipped" : "To do"}
                </span>
              </button>
              <button
                type="button"
                className="secondary"
                disabled={disabled || index === 0}
                aria-label={`Move set ${index + 1} up`}
                onClick={() => moveOne(set.id, -1)}
              >
                ↑
              </button>
              <button
                type="button"
                className="secondary"
                disabled={disabled || index === movement.sets.length - 1}
                aria-label={`Move set ${index + 1} down`}
                onClick={() => moveOne(set.id, 1)}
              >
                ↓
              </button>
            </div>
            <div className="managed-set-actions">
              <details>
                <summary>Insert a set here</summary>
                <button
                  type="button"
                  className="secondary"
                  disabled={disabled}
                  aria-label={`Insert warm-up before set ${index + 1}`}
                  onClick={() => insert(set.id, "before", "warmup")}
                >
                  Warm-up before
                </button>
                <button
                  type="button"
                  className="secondary"
                  disabled={disabled}
                  aria-label={`Insert warm-up after set ${index + 1}`}
                  onClick={() => insert(set.id, "after", "warmup")}
                >
                  Warm-up after
                </button>
                <button
                  type="button"
                  className="secondary"
                  disabled={disabled}
                  aria-label={`Insert set after set ${index + 1}`}
                  onClick={() => insert(set.id, "after", "working")}
                >
                  Working set after
                </button>
              </details>
              {set.done && (
                <button
                  type="button"
                  className="secondary"
                  disabled={disabled}
                  aria-label={`Restart set ${index + 1}`}
                  onClick={() => restart(set.id)}
                >
                  Restart
                </button>
              )}
              <button
                type="button"
                className="ghost"
                disabled={disabled}
                aria-label={`Delete set ${index + 1}`}
                onClick={() => remove(set.id)}
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
      {dragged && (
        <div
          className={`set-drop-end ${over === "end" ? "drop-target" : ""}`}
          data-set-end
          onDragOver={(event) => {
            event.preventDefault();
            targetAt(event.clientX, event.clientY);
          }}
          onDrop={(event) => {
            event.preventDefault();
            if (!disabled) drop();
          }}
        >
          Drop here to move to the end
        </div>
      )}
      <p className="hint" role="status">
        {dragged
          ? "Drop above or below another set to move it there. You can undo the move."
          : "Changes stay in this workout. Use Undo to restore a deleted or moved set."}
      </p>
    </details>
  );
}
