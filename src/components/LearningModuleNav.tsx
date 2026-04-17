import type { LearningModule } from "../learning/types";
import { decodeEscapedUnicode } from "../utils/decodeEscapedUnicode";

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
            <span>{decodeEscapedUnicode(module.summary)}</span>
          </span>
        </button>
      ))}
    </div>
  );
}
