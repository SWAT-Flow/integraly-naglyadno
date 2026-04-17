import { memo, useLayoutEffect, useState } from "react";
import { expressionToTex, formatExpressionText } from "../math/parser";
import type { ExpressionViewModel } from "../types";
import { decodeEscapedUnicode } from "../utils/decodeEscapedUnicode";
import { FormulaCard } from "./FormulaCard";

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

  useLayoutEffect(() => {
    if (!active) {
      setIsEditing(false);
      return;
    }

    if (editorRequest > 0) {
      setIsEditing(true);
    }
  }, [active, editorRequest]);

  const visibilityLabel = expression.visible
    ? "\u0421\u043a\u0440\u044b\u0442\u044c \u0433\u0440\u0430\u0444\u0438\u043a"
    : "\u041f\u043e\u043a\u0430\u0437\u0430\u0442\u044c \u0433\u0440\u0430\u0444\u0438\u043a";
  const selectRowLabel = "\u0412\u044b\u0431\u0440\u0430\u0442\u044c \u0441\u0442\u0440\u043e\u043a\u0443 \u0432\u044b\u0440\u0430\u0436\u0435\u043d\u0438\u044f";
  const editRowLabel = "\u0420\u0435\u0434\u0430\u043a\u0442\u0438\u0440\u043e\u0432\u0430\u0442\u044c \u0432\u044b\u0440\u0430\u0436\u0435\u043d\u0438\u0435";
  const deleteLabel = "\u0423\u0434\u0430\u043b\u0438\u0442\u044c \u0432\u044b\u0440\u0430\u0436\u0435\u043d\u0438\u0435";
  const previewPrefix = expression.orientation === "xOfY" ? "x = " : "y = ";
  const previewSource = expression.normalized || expression.text;
  const previewTex = expression.normalized ? `${previewPrefix}${expressionToTex(expression.normalized)}` : null;
  const displayText = expression.text.trim()
    ? `${previewPrefix}${formatExpressionText(previewSource)}`
    : `${previewPrefix}\u2026`;

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
            <input
              ref={inputRef}
              className="expression-input"
              onBlur={() => setIsEditing(false)}
              onChange={(event) => onChange(event.target.value)}
              onFocus={() => {
                onActivate();
                setIsEditing(true);
              }}
              placeholder="Например: y = sin(x)"
              spellCheck={false}
              type="text"
              value={expression.text}
            />
          ) : (
            <button
              aria-label={editRowLabel}
              className="expression-display"
              onClick={onActivate}
              type="button"
            >
              {expression.isValid && previewTex ? (
                <FormulaCard tex={previewTex} displayMode={false} className="expression-display-formula" />
              ) : (
                <span className={`expression-display-text ${expression.text.trim() ? "" : "expression-display-empty"}`}>
                  {displayText}
                </span>
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
