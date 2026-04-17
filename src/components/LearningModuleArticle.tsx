import type { LearningModule, LearningPreset } from "../learning/types";
import { decodeEscapedUnicode } from "../utils/decodeEscapedUnicode";
import { Card } from "./ui";
import { LearningSectionRenderer } from "./LearningSectionRenderer";

interface LearningModuleArticleProps {
  module: LearningModule;
  onOpenPreset: (preset: LearningPreset) => void;
}

export function LearningModuleArticle({ module, onOpenPreset }: LearningModuleArticleProps) {
  const presetMap = new Map(module.presets.map((preset) => [preset.id, preset]));

  return (
    <Card title={module.title} subtitle={module.summary}>
      <div className="learning-article">
        <div className="learning-summary">
          <strong>{decodeEscapedUnicode("Кратко")}</strong>
          <p>{decodeEscapedUnicode(module.summary)}</p>
        </div>

        {module.sections.map((section, index) => (
          <LearningSectionRenderer
            key={`${module.id}-${section.type}-${index}`}
            onOpenPreset={onOpenPreset}
            presetMap={presetMap}
            section={section}
          />
        ))}
      </div>
    </Card>
  );
}
