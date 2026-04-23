import { memo, useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  applyMathFieldBackspace,
  applyMathFieldCharacter,
  collapseSimpleDenominatorGroups,
  moveMathFieldSelection,
  resolveActiveSlotPath,
  type MathFieldSelectionState,
} from "../math/mathFieldEditing";
import type { ExpressionViewModel } from "../types";
import { decodeEscapedUnicode } from "../utils/decodeEscapedUnicode";
import { PrettyExpression } from "./PrettyExpression";

interface ExpressionRowProps {
  expression: ExpressionViewModel;
  active: boolean;
  editorRequest: number;
  availableColors: string[];
  onActivate: () => void;
  onChange: (value: string) => void;
  onChangeColor: (color: string) => void;
  onDelete: () => void;
  onToggleVisible: () => void;
  inputRef: (node: HTMLInputElement | null) => void;
}

function readSelection(input: HTMLInputElement | null, fallback: number) {
  if (!input) {
    return { start: fallback, end: fallback };
  }

  return {
    start: input.selectionStart ?? fallback,
    end: input.selectionEnd ?? fallback,
  };
}

function rawIndexFromElementHit(anchor: HTMLElement, clientX: number, fallback: number) {
  const rawStart = Number(anchor.dataset.rawStart ?? fallback);
  const rawEnd = Number(anchor.dataset.rawEnd ?? fallback);
  const displayLength = Number(anchor.dataset.displayLength ?? Array.from(anchor.textContent ?? "").length);

  if (displayLength <= 0 || rawEnd <= rawStart) {
    return clientX <= anchor.getBoundingClientRect().left + anchor.getBoundingClientRect().width / 2 ? rawStart : rawEnd;
  }

  const rect = anchor.getBoundingClientRect();
  const ratio = rect.width > 0 ? (clientX - rect.left) / rect.width : 0;
  return Math.min(rawEnd, Math.max(rawStart, Math.round(rawStart + ratio * (rawEnd - rawStart))));
}

function ExpressionRowComponent({
  expression,
  active,
  editorRequest,
  availableColors,
  onActivate,
  onChange,
  onChangeColor,
  onDelete,
  onToggleVisible,
  inputRef,
}: ExpressionRowProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [selection, setSelection] = useState(() => ({ start: expression.text.length, end: expression.text.length }));
  const [activeSlotPath, setActiveSlotPath] = useState<string | null>(null);
  const [pendingAutoExponentPath, setPendingAutoExponentPath] = useState<string | null>(null);
  const rowRef = useRef<HTMLDivElement | null>(null);
  const localInputRef = useRef<HTMLInputElement | null>(null);
  const pendingSelectionRef = useRef<MathFieldSelectionState | null>(null);

  useLayoutEffect(() => {
    if (!active) {
      setIsEditing(false);
      setActiveSlotPath(null);
      setPendingAutoExponentPath(null);
      setPaletteOpen(false);
      return;
    }

    if (editorRequest > 0) {
      setIsEditing(true);
    }
  }, [active, editorRequest]);

  useLayoutEffect(() => {
    const input = localInputRef.current;
    if (!input || globalThis.document?.activeElement !== input) {
      return;
    }

    const pending = pendingSelectionRef.current;
    if (pending) {
      input.setSelectionRange(pending.start, pending.end);
      setSelection({ start: pending.start, end: pending.end });
      setActiveSlotPath(
        pending.activeSlotPath === null ? null : resolveActiveSlotPath(expression.text, pending.end, pending.activeSlotPath),
      );
      setPendingAutoExponentPath(pending.pendingAutoExponentPath ?? null);
      pendingSelectionRef.current = null;
      return;
    }

    const nextSelection = readSelection(input, expression.text.length);
    setSelection(nextSelection);
    const resolvedSlotPath = resolveActiveSlotPath(expression.text, nextSelection.end, activeSlotPath);
    setActiveSlotPath(resolvedSlotPath);
    setPendingAutoExponentPath((current) => (current && resolvedSlotPath === current ? current : null));
  }, [activeSlotPath, expression.text]);

  useEffect(() => {
    if (!paletteOpen) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (!rowRef.current?.contains(event.target as Node)) {
        setPaletteOpen(false);
      }
    };

    globalThis.document?.addEventListener("pointerdown", handlePointerDown);
    return () => globalThis.document?.removeEventListener("pointerdown", handlePointerDown);
  }, [paletteOpen]);

  const visibilityLabel = expression.visible
    ? "\u0421\u043a\u0440\u044b\u0442\u044c \u0433\u0440\u0430\u0444\u0438\u043a"
    : "\u041f\u043e\u043a\u0430\u0437\u0430\u0442\u044c \u0433\u0440\u0430\u0444\u0438\u043a";
  const selectRowLabel = "\u0412\u044b\u0431\u0440\u0430\u0442\u044c \u0441\u0442\u0440\u043e\u043a\u0443 \u0432\u044b\u0440\u0430\u0436\u0435\u043d\u0438\u044f";
  const editRowLabel = "\u0420\u0435\u0434\u0430\u043a\u0442\u0438\u0440\u043e\u0432\u0430\u0442\u044c \u0432\u044b\u0440\u0430\u0436\u0435\u043d\u0438\u0435";
  const deleteLabel = "\u0423\u0434\u0430\u043b\u0438\u0442\u044c \u0432\u044b\u0440\u0430\u0436\u0435\u043d\u0438\u0435";
  const previewPrefix = expression.orientation === "xOfY" ? "x = " : "y = ";
  const previewSource = expression.isValid && expression.normalized ? expression.normalized : expression.text;
  const hasContent = expression.text.trim().length > 0;

  const syncSelectionFromInput = (raw = expression.text, preferredPath = activeSlotPath) => {
    const nextSelection = readSelection(localInputRef.current, raw.length);
    const resolvedSlotPath = resolveActiveSlotPath(raw, nextSelection.end, preferredPath);
    setSelection(nextSelection);
    setActiveSlotPath(resolvedSlotPath);
    setPendingAutoExponentPath((current) => (current && resolvedSlotPath === current ? current : null));
  };

  const setRawSelection = (
    start: number,
    end = start,
    nextSlotPath: string | null = null,
    nextPendingAutoExponentPath: string | null = null,
    trustSlotPath = false,
  ) => {
    const input = localInputRef.current;
    if (!input) {
      return;
    }

    input.focus();
    input.setSelectionRange(start, end);
    setSelection({ start, end });
    setActiveSlotPath(trustSlotPath ? nextSlotPath : resolveActiveSlotPath(expression.text, end, nextSlotPath));
    setPendingAutoExponentPath(nextPendingAutoExponentPath);
  };

  const commitStructuredEdit = (raw: string, nextState: MathFieldSelectionState) => {
    if (raw === expression.text) {
      setRawSelection(
        nextState.start,
        nextState.end,
        nextState.activeSlotPath,
        nextState.pendingAutoExponentPath ?? null,
        true,
      );
      return;
    }

    pendingSelectionRef.current = nextState;
    onChange(raw);
  };

  useLayoutEffect(() => {
    if (!active || !isEditing) {
      return;
    }

    const root = rowRef.current?.querySelector<HTMLElement>(".expression-editor-pretty");
    if (!root) {
      return;
    }

    const handleMathPointer = (event: PointerEvent | MouseEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      if (!target || !root.contains(target)) {
        return;
      }

      const slotElement = target.closest<HTMLElement>("[data-slot-path]");
      const anchor = target.closest<HTMLElement>("[data-raw-start]");
      let rawIndex: number | null = anchor ? rawIndexFromElementHit(anchor, event.clientX, expression.text.length) : null;

      if (rawIndex === null && slotElement) {
        const allHits = Array.from(slotElement.querySelectorAll<HTMLElement>("[data-raw-start]"));
        const visibleHits = allHits.filter((hit) => Number(hit.dataset.displayLength ?? Array.from(hit.textContent ?? "").length) > 0);
        const hits = visibleHits.length ? visibleHits : allHits;
        if (hits.length) {
          const rawStart = Math.min(...hits.map((hit) => Number(hit.dataset.rawStart ?? expression.text.length)));
          const rawEnd = Math.max(...hits.map((hit) => Number(hit.dataset.rawEnd ?? expression.text.length)));
          const rect = slotElement.getBoundingClientRect();
          rawIndex = event.clientX <= rect.left + rect.width / 2 ? rawStart : rawEnd;
        }
      }

      if (rawIndex === null) {
        const rect = root.getBoundingClientRect();
        rawIndex = event.clientX <= rect.left + rect.width / 2 ? 0 : expression.text.length;
      }

      event.preventDefault();
      setRawSelection(rawIndex, rawIndex, slotElement?.dataset.slotPath ?? null, null, true);
    };

    root.addEventListener("pointerdown", handleMathPointer, true);
    root.addEventListener("mousedown", handleMathPointer, true);
    return () => {
      root.removeEventListener("pointerdown", handleMathPointer, true);
      root.removeEventListener("mousedown", handleMathPointer, true);
    };
  }, [active, expression.text, isEditing]);

  return (
    <div ref={rowRef} className={`expression-row ${active ? "expression-row-active" : ""}`}>
      <div className="expression-main">
        <button
          aria-label={selectRowLabel}
          className="expression-swatch"
          onMouseDown={(event) => {
            event.preventDefault();
          }}
          onClick={() => {
            onActivate();
            setPaletteOpen((current) => (active ? !current : true));
          }}
          style={{ backgroundColor: expression.color }}
          type="button"
        />

        <div className="expression-entry">
          {isEditing ? (
            <div className="expression-editor-shell">
              <input
                ref={(node) => {
                  localInputRef.current = node;
                  inputRef(node);
                }}
                className="expression-input expression-input-hidden"
                onBlur={() => {
                  setIsEditing(false);
                  setActiveSlotPath(null);
                  const collapsed = collapseSimpleDenominatorGroups(expression.text);
                  if (collapsed !== expression.text) {
                    onChange(collapsed);
                  }
                }}
                onChange={(event) => {
                  const nextSelection = readSelection(event.currentTarget, event.currentTarget.value.length);
                  setSelection(nextSelection);
                  setActiveSlotPath(resolveActiveSlotPath(event.currentTarget.value, nextSelection.end, activeSlotPath));
                  onChange(event.target.value);
                }}
                onClick={() => syncSelectionFromInput()}
                onFocus={() => {
                  onActivate();
                  setIsEditing(true);
                  syncSelectionFromInput();
                }}
                onKeyDown={(event) => {
                  if (event.nativeEvent.isComposing || event.ctrlKey || event.metaKey || event.altKey) {
                    return;
                  }

                  const input = event.currentTarget;
                  const currentState: MathFieldSelectionState = {
                    start: input.selectionStart ?? expression.text.length,
                    end: input.selectionEnd ?? expression.text.length,
                    activeSlotPath,
                    pendingAutoExponentPath,
                  };

                  if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
                    const nextState = moveMathFieldSelection(
                      expression.text,
                      currentState,
                      event.key === "ArrowRight" ? "right" : "left",
                    );
                    if (nextState) {
                      event.preventDefault();
                      setRawSelection(
                        nextState.start,
                        nextState.end,
                        nextState.activeSlotPath,
                        nextState.pendingAutoExponentPath ?? null,
                        true,
                      );
                    }
                    return;
                  }

                  if (event.key === "Backspace") {
                    const nextEdit = applyMathFieldBackspace(expression.text, currentState);
                    if (nextEdit?.handled) {
                      event.preventDefault();
                      commitStructuredEdit(nextEdit.raw, nextEdit.next);
                    }
                    return;
                  }

                  if (event.key.length !== 1) {
                    return;
                  }

                  const nextEdit = applyMathFieldCharacter(expression.text, currentState, event.key);
                  if (nextEdit.handled) {
                    event.preventDefault();
                    commitStructuredEdit(nextEdit.raw, nextEdit.next);
                  }
                }}
                onKeyUp={() => syncSelectionFromInput()}
                onSelect={() => syncSelectionFromInput()}
                spellCheck={false}
                type="text"
                value={expression.text}
              />

              <div className={`expression-editor-display ${hasContent ? "" : "expression-editor-display-empty"}`}>
                {hasContent ? (
                  <button
                    className="expression-editor-prefix"
                    onPointerDown={(event) => {
                      event.preventDefault();
                      setRawSelection(0, 0, null, null, true);
                    }}
                    type="button"
                  >
                    {previewPrefix}
                  </button>
                ) : null}
                {hasContent ? (
                  <PrettyExpression
                    activeSlotPath={activeSlotPath}
                    className="expression-editor-pretty"
                    expression={expression.text}
                    onPointerDown={(target) => {
                      onActivate();
                      setRawSelection(target.rawIndex, target.rawIndex, target.slotPath, null, true);
                    }}
                    selectionEnd={selection.end}
                    selectionStart={selection.start}
                  />
                ) : (
                  <button
                    className="expression-editor-placeholder"
                    onPointerDown={(event) => {
                      event.preventDefault();
                      onActivate();
                      setRawSelection(0, 0, null, null, true);
                    }}
                    type="button"
                  >
                    <span className="expression-editor-placeholder-text">sin(x)</span>
                    {selection.start === 0 && selection.end === 0 ? <span className="pretty-expression-caret" /> : null}
                  </button>
                )}
              </div>
            </div>
          ) : (
            <button aria-label={editRowLabel} className="expression-display" onClick={onActivate} type="button">
              {hasContent ? <span className="expression-display-prefix">{previewPrefix}</span> : null}
              {previewSource.trim() ? (
                <PrettyExpression className="expression-display-pretty" compact expression={previewSource} />
              ) : (
                <span className="expression-display-text expression-display-empty">\u2026</span>
              )}
            </button>
          )}
        </div>

        <button
          aria-label={visibilityLabel}
          className="expression-action"
          onClick={onToggleVisible}
          title={visibilityLabel}
          type="button"
        >
          {expression.visible ? "\u0412\u043a\u043b" : "\u0412\u044b\u043a"}
        </button>
        <button
          aria-label={deleteLabel}
          className="expression-action"
          onClick={onDelete}
          title={deleteLabel}
          type="button"
        >
          {"\u00d7"}
        </button>
      </div>

      {paletteOpen ? (
        <div className="expression-color-picker" role="listbox" aria-label="Цвет функции">
          {availableColors.map((color) => (
            <button
              key={`${expression.id}-${color}`}
              aria-label={`Выбрать цвет ${color}`}
              className={`expression-color-option ${expression.color === color ? "expression-color-option-active" : ""}`.trim()}
              onClick={() => {
                onChangeColor(color);
                setPaletteOpen(false);
              }}
              onPointerDown={(event) => {
                event.preventDefault();
                event.stopPropagation();
                onChangeColor(color);
                setPaletteOpen(false);
              }}
              style={{ backgroundColor: color }}
              type="button"
            />
          ))}
        </div>
      ) : null}

      {expression.error ? <div className="expression-error">{decodeEscapedUnicode(expression.error)}</div> : null}
    </div>
  );
}

export const ExpressionRow = memo(ExpressionRowComponent);
