import type { MutableRefObject } from "react";
import type { ExpressionViewModel } from "../types";
import { decodeEscapedUnicode } from "../utils/decodeEscapedUnicode";
import { Button, Card } from "./ui";
import { ExpressionRow } from "./ExpressionRow";

interface ExpressionListProps {
  expressions: ExpressionViewModel[];
  activeId: string | null;
  editorRequest: number;
  availableColors: string[];
  inputRefs: MutableRefObject<Record<string, HTMLInputElement | null>>;
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
  onActivate,
  onAdd,
  onChange,
  onChangeColor,
  onDelete,
  onToggleVisible,
}: ExpressionListProps) {
  return (
    <Card
      title="\u0412\u044b\u0440\u0430\u0436\u0435\u043d\u0438\u044f"
      subtitle="\u0412\u0432\u043e\u0434\u0438\u0442\u0435 \u0444\u043e\u0440\u043c\u0443\u043b\u044b, \u0441\u043a\u0440\u044b\u0432\u0430\u0439\u0442\u0435 \u043b\u0438\u043d\u0438\u0438 \u0438 \u0443\u0434\u0430\u043b\u044f\u0439\u0442\u0435 \u0441\u0442\u0440\u043e\u043a\u0438 \u0442\u0430\u043a \u0436\u0435, \u043a\u0430\u043a \u0432 \u0433\u0440\u0430\u0444\u0438\u0447\u0435\u0441\u043a\u043e\u043c \u043a\u0430\u043b\u044c\u043a\u0443\u043b\u044f\u0442\u043e\u0440\u0435."
      footer={<Button onClick={onAdd}>\u0414\u043e\u0431\u0430\u0432\u0438\u0442\u044c</Button>}
    >
      <div className="expression-list">
        {expressions.map((expression) => (
          <ExpressionRow
            key={expression.id}
            active={expression.id === activeId}
            availableColors={availableColors}
            editorRequest={editorRequest}
            expression={expression}
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
        {!expressions.length ? (
          <div className="empty-state">
            {decodeEscapedUnicode(
              "\u0421\u043f\u0438\u0441\u043e\u043a \u043f\u0443\u0441\u0442. \u0414\u043e\u0431\u0430\u0432\u044c\u0442\u0435 \u043f\u0435\u0440\u0432\u0443\u044e \u0444\u0443\u043d\u043a\u0446\u0438\u044e.",
            )}
          </div>
        ) : null}
      </div>
    </Card>
  );
}
