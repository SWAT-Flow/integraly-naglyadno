import { useLayoutEffect, useRef } from "react";
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
  const articleRef = useRef<HTMLDivElement | null>(null);

  useLayoutEffect(() => {
    const article = articleRef.current;
    if (!article) {
      return;
    }

    article.scrollTop = 0;
    if (typeof article.scrollTo === "function") {
      article.scrollTo({ top: 0, behavior: "auto" });
    }
  }, [module.id]);

  return (
    <Card title={module.title} subtitle={module.summary}>
      <div className="learning-article" ref={articleRef}>
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
