import type { LearningPreset, LearningSection } from "../learning/types";
import { decodeEscapedUnicode } from "../utils/decodeEscapedUnicode";
import { FormulaCard, InlineFormula } from "./FormulaCard";
import { PracticeCard } from "./PracticeCard";

interface LearningSectionRendererProps {
  section: LearningSection;
  presetMap: Map<string, LearningPreset>;
  onOpenPreset: (preset: LearningPreset) => void;
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

export function LearningSectionRenderer({
  section,
  presetMap,
  onOpenPreset,
}: LearningSectionRendererProps) {
  if (section.type === "heading") {
    return <h3 className="learning-section-title">{decodeEscapedUnicode(section.text)}</h3>;
  }

  if (section.type === "paragraph") {
    return <p className="learning-paragraph">{renderInlineContent(section.text)}</p>;
  }

  if (section.type === "formula") {
    return (
      <div className="learning-formula-block">
        {section.title ? <div className="learning-block-title">{decodeEscapedUnicode(section.title)}</div> : null}
        {section.tex ? (
          <FormulaCard tex={section.tex} className="learning-formula-card" />
        ) : (
          <div className="learning-fallback-formula">{decodeEscapedUnicode(section.fallbackText ?? "")}</div>
        )}
        {section.note ? <p className="learning-note">{renderInlineContent(section.note)}</p> : null}
      </div>
    );
  }

  if (section.type === "list") {
    return (
      <div className="learning-list-block">
        {section.title ? <div className="learning-block-title">{decodeEscapedUnicode(section.title)}</div> : null}
        <ul className="learning-list">
          {section.items.map((item, index) => (
            <li key={`${item}-${index}`}>{renderInlineContent(item)}</li>
          ))}
        </ul>
      </div>
    );
  }

  if (section.type === "callout") {
    return (
      <div className={`learning-callout learning-callout-${section.tone ?? "blue"}`}>
        {section.title ? <div className="learning-block-title">{decodeEscapedUnicode(section.title)}</div> : null}
        <p>{renderInlineContent(section.text)}</p>
      </div>
    );
  }

  return (
    <div className="learning-practice-grid">
      {section.title ? <h3 className="learning-section-title">{decodeEscapedUnicode(section.title)}</h3> : null}
      {section.items.map((item) => {
        const preset = presetMap.get(item.presetId) ?? null;
        return (
          <PracticeCard
            key={item.id}
            item={item}
            onOpenPreset={preset ? () => onOpenPreset(preset) : undefined}
          />
        );
      })}
    </div>
  );
}
