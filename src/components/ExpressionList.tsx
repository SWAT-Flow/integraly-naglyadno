import { useState, type MutableRefObject, type ReactNode } from "react";
import type { ExpressionViewModel } from "../types";
import { ExpressionRow } from "./ExpressionRow";

interface ExpressionListProps {
  expressions: ExpressionViewModel[];
  activeId: string | null;
  editorRequest: number;
  availableColors: string[];
  inputRefs: MutableRefObject<Record<string, HTMLInputElement | null>>;
  keyboardSlot: ReactNode;
  onActivate: (id: string) => void;
  onAdd: () => void;
  onChange: (id: string, value: string) => void;
  onChangeColor: (id: string, color: string) => void;
  onDelete: (id: string) => void;
  onToggleVisible: (id: string) => void;
}

export function ExpressionList({
  expressions,
  activeId,
  editorRequest,
  availableColors,
  inputRefs,
  keyboardSlot,
  onActivate,
  onAdd,
  onChange,
  onChangeColor,
  onDelete,
  onToggleVisible,
}: ExpressionListProps) {
  const [keyboardOpen, setKeyboardOpen] = useState(false);

  return (
    <div className="expression-panel">
      <div className="expression-panel-scroll">
        <div className="expression-list">
          {expressions.map((expression, index) => (
            <ExpressionRow
              key={expression.id}
              active={expression.id === activeId}
              availableColors={availableColors}
              editorRequest={editorRequest}
              expression={expression}
              rowIndex={index + 1}
              inputRef={(node) => {
                inputRefs.current[expression.id] = node;
              }}
              onActivate={() => onActivate(expression.id)}
              onChange={(value) => onChange(expression.id, value)}
              onChangeColor={(color) => onChangeColor(expression.id, color)}
              onDelete={() => onDelete(expression.id)}
              onToggleVisible={() => onToggleVisible(expression.id)}
            />
          ))}
        </div>

        <button
          className="expression-add-row"
          onClick={onAdd}
          type="button"
        >
          <span className="expression-add-icon">+</span>
          <span>добавить выражение...</span>
        </button>
      </div>

      <button
        className="keyboard-toggle"
        onClick={() => setKeyboardOpen((v) => !v)}
        type="button"
      >
        <span
          className={`keyboard-toggle-icon ${keyboardOpen ? "keyboard-toggle-icon-open" : ""}`}
        >
          ▲
        </span>
        {keyboardOpen ? "Скрыть клавиатуру" : "Показать клавиатуру"}
      </button>

      {keyboardOpen ? (
        <div className="expression-panel-keyboard">
          {keyboardSlot}
        </div>
      ) : null}
    </div>
  );
}
