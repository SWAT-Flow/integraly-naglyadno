import { useState } from "react";
import { tokenizeInlineMath } from "../learning/inlineMath";
import type { PracticeItem } from "../learning/types";
import { decodeEscapedUnicode } from "../utils/decodeEscapedUnicode";
import { InlineFormula } from "./FormulaCard";
import { Button, Card } from "./ui";

interface PracticeCardProps {
  item: PracticeItem;
  onOpenPreset?: () => void;
}

function renderInlineContent(text: string) {
  return tokenizeInlineMath(text).map((part, index) =>
    part.type === "tex" ? (
      <InlineFormula key={`${part.value}-${index}`} tex={part.value} className="learning-inline-formula" />
    ) : (
      <span key={`${part.value}-${index}`}>{decodeEscapedUnicode(part.value)}</span>
    ),
  );
}

export function PracticeCard({ item, onOpenPreset }: PracticeCardProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Card
      title={`${item.level} уровень`}
      subtitle={item.answer ? "Задание с кратким ответом и разбором." : "Короткое учебное задание."}
      footer={
        <div className="practice-actions">
          <Button onClick={() => setExpanded((current) => !current)}>
            {expanded ? "Скрыть ответ" : "Показать ответ"}
          </Button>
          {onOpenPreset ? <Button onClick={onOpenPreset}>Открыть пример в калькуляторе</Button> : null}
        </div>
      }
    >
      <div className="practice-prompt">{renderInlineContent(item.prompt)}</div>
      {expanded && item.answer ? <div className="practice-answer">{renderInlineContent(item.answer)}</div> : null}
      {expanded && item.solution ? <div className="practice-solution">{renderInlineContent(item.solution)}</div> : null}
    </Card>
  );
}
