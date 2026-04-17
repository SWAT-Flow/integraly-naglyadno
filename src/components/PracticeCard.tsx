import { useState } from "react";
import type { PracticeItem } from "../learning/types";
import { decodeEscapedUnicode } from "../utils/decodeEscapedUnicode";
import { InlineFormula } from "./FormulaCard";
import { Button, Card } from "./ui";

interface PracticeCardProps {
  item: PracticeItem;
  onOpenPreset?: () => void;
}

function renderInlineContent(text: string) {
  const parts = text.split(/(\{\{tex:[\s\S]+?\}\})/g).filter(Boolean);

  return parts.map((part, index) => {
    const match = /^\{\{tex:([\s\S]+)\}\}$/.exec(part);
    if (!match) {
      return <span key={`${part}-${index}`}>{decodeEscapedUnicode(part)}</span>;
    }

    return <InlineFormula key={`${match[1]}-${index}`} tex={match[1]} className="learning-inline-formula" />;
  });
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
