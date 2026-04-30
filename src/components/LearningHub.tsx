import { useMemo } from "react";
import { LEARNING_MODULES } from "../learning/modules";
import type { LearningPreset } from "../learning/types";
import { Card } from "./ui";
import { LearningModuleArticle } from "./LearningModuleArticle";
import { LearningModuleNav } from "./LearningModuleNav";

interface LearningHubProps {
  activeModuleId: string;
  onOpenPreset: (preset: LearningPreset) => void;
  onSelectModule: (moduleId: string) => void;
}

export function LearningHub({ activeModuleId, onOpenPreset, onSelectModule }: LearningHubProps) {
  const activeModule = useMemo(
    () => LEARNING_MODULES.find((module) => module.id === activeModuleId) ?? LEARNING_MODULES[0],
    [activeModuleId],
  );

  return (
    <main className="modules-layout">
      <aside className="modules-nav-column">
        <Card
          title="Учебные модули"
          subtitle="Мини-уроки по определённому интегралу с формулами, краткой теорией и готовыми примерами."
        >
          <LearningModuleNav
            activeModuleId={activeModule.id}
            modules={LEARNING_MODULES}
            onSelect={onSelectModule}
          />
        </Card>
      </aside>

      <section className="modules-content-column">
        <LearningModuleArticle module={activeModule} onOpenPreset={onOpenPreset} />
      </section>
    </main>
  );
}
