import { memo, useLayoutEffect, useRef, useState } from "react";
import type { ExpressionViewModel } from "../types";
import { decodeEscapedUnicode } from "../utils/decodeEscapedUnicode";
import { PrettyExpression } from "./PrettyExpression";

interface ExpressionRowProps {
  expression: ExpressionViewModel;
  active: boolean;
  editorRequest: number;
  onActivate: () => void;
  onChange: (value: string) => void;
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

function ExpressionRowComponent({
  expression,
  active,
  editorRequest,
  onActivate,
  onChange,
  onDelete,
  onToggleVisible,
  inputRef,
}: ExpressionRowProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [selection, setSelection] = useState(() => ({ start: expression.text.length, end: expression.text.length }));
  const localInputRef = useRef<HTMLInputElement | null>(null);

  useLayoutEffect(() => {
    if (!active) {
      setIsEditing(false);
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

    setSelection(readSelection(input, expression.text.length));
  }, [expression.text]);

  const visibilityLabel = expression.visible ? "Скрыть график" : "Показать график";
  const selectRowLabel = "Выбрать строку выражения";
  const editRowLabel = "Редактировать выражение";
  const deleteLabel = "Удалить выражение";
  const previewPrefix = expression.orientation === "xOfY" ? "x = " : "y = ";
  const previewSource = expression.isValid && expression.normalized ? expression.normalized : expression.text;
  const hasContent = expression.text.trim().length > 0;

  const syncSelectionFromInput = () => {
    setSelection(readSelection(localInputRef.current, expression.text.length));
  };

  const setRawSelection = (start: number, end = start) => {
    const input = localInputRef.current;
    if (!input) {
      return;
    }

    input.focus();
    input.setSelectionRange(start, end);
    setSelection({ start, end });
  };

  return (
    <div className={`expression-row ${active ? "expression-row-active" : ""}`}>
      <div className="expression-main">
        <button
          aria-label={selectRowLabel}
          className="expression-swatch"
          onClick={onActivate}
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
                onBlur={() => setIsEditing(false)}
                onChange={(event) => {
                  setSelection(readSelection(event.currentTarget, event.currentTarget.value.length));
                  onChange(event.target.value);
                }}
                onClick={syncSelectionFromInput}
                onFocus={() => {
                  onActivate();
                  setIsEditing(true);
                  syncSelectionFromInput();
                }}
                onKeyUp={syncSelectionFromInput}
                onSelect={syncSelectionFromInput}
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
                      setRawSelection(0);
                    }}
                    type="button"
                  >
                    {previewPrefix}
                  </button>
                ) : null}
                {hasContent ? (
                  <PrettyExpression
                    className="expression-editor-pretty"
                    expression={expression.text}
                    onPointerDown={(rawIndex) => {
                      onActivate();
                      setRawSelection(rawIndex);
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
                      setRawSelection(0);
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
                <span className="expression-display-text expression-display-empty">…</span>
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
          {expression.visible ? "Вкл" : "Выкл"}
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

      {expression.error ? <div className="expression-error">{decodeEscapedUnicode(expression.error)}</div> : null}
    </div>
  );
}

export const ExpressionRow = memo(ExpressionRowComponent);
