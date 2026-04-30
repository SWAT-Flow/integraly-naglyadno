import type { LearningPreset, LearningSection } from "../learning/types";
import { decodeEscapedUnicode } from "../utils/decodeEscapedUnicode";
import { FormulaCard } from "./FormulaCard";
import { renderInlineContent } from "./InlineContent";
import { PracticeCard } from "./PracticeCard";

interface LearningSectionRendererProps {
  section: LearningSection;
  presetMap: Map<string, LearningPreset>;
  onOpenPreset: (preset: LearningPreset) => void;
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
    return <p className="learning-paragraph">{renderInlineContent(section.text, "learning-inline-formula")}</p>;
  }

  if (section.type === "formula") {
    return (
      <div className="learning-formula-block">
        {section.title ? (
          <div className="learning-block-title">{renderInlineContent(section.title, "learning-inline-formula")}</div>
        ) : null}
        {section.tex ? (
          <FormulaCard tex={section.tex} className="learning-formula-card" />
        ) : (
          <div className="learning-fallback-formula">{decodeEscapedUnicode(section.fallbackText ?? "")}</div>
        )}
        {section.note ? (
          <p className="learning-note">{renderInlineContent(section.note, "learning-inline-formula")}</p>
        ) : null}
      </div>
    );
  }

  if (section.type === "list") {
    return (
      <div className="learning-list-block">
        {section.title ? (
          <div className="learning-block-title">{renderInlineContent(section.title, "learning-inline-formula")}</div>
        ) : null}
        <ul className="learning-list">
          {section.items.map((item, index) => (
            <li key={`${item}-${index}`}>{renderInlineContent(item, "learning-inline-formula")}</li>
          ))}
        </ul>
      </div>
    );
  }

  if (section.type === "callout") {
    return (
      <div className={`learning-callout learning-callout-${section.tone ?? "blue"}`}>
        {section.title ? (
          <div className="learning-block-title">{renderInlineContent(section.title, "learning-inline-formula")}</div>
        ) : null}
        <p>{renderInlineContent(section.text, "learning-inline-formula")}</p>
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
