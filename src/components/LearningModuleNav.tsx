import type { LearningModule } from "../learning/types";
import { decodeEscapedUnicode } from "../utils/decodeEscapedUnicode";
import { InlineContent } from "./InlineContent";

interface LearningModuleNavProps {
  modules: LearningModule[];
  activeModuleId: string;
  onSelect: (moduleId: string) => void;
}

export function LearningModuleNav({ modules, activeModuleId, onSelect }: LearningModuleNavProps) {
  return (
    <div className="learning-module-list">
      {modules.map((module, index) => (
        <button
          key={module.id}
          className={`learning-module-item ${module.id === activeModuleId ? "learning-module-item-active" : ""}`}
          onClick={() => onSelect(module.id)}
          type="button"
        >
          <span className="learning-module-order">{index + 1}</span>
          <span className="learning-module-copy">
            <strong>{decodeEscapedUnicode(module.title)}</strong>
            <span>
              <InlineContent text={module.summary} formulaClassName="learning-inline-formula" />
            </span>
          </span>
        </button>
      ))}
    </div>
  );
}
