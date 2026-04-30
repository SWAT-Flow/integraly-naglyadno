import type { LearningPresetScenario, Tone } from "../types";

export interface LearningPreset extends LearningPresetScenario {
  id: string;
  title: string;
  description: string;
}

export interface PracticeItem {
  id: string;
  level: "Базовый" | "Средний" | "Сложный";
  prompt: string;
  answer?: string;
  solution?: string;
  presetId: string;
}

export type LearningSection =
  | {
      type: "heading";
      text: string;
    }
  | {
      type: "paragraph";
      text: string;
    }
  | {
      type: "formula";
      title?: string;
      tex?: string | null;
      fallbackText?: string;
      note?: string;
    }
  | {
      type: "list";
      title?: string;
      items: string[];
    }
  | {
      type: "callout";
      title?: string;
      text: string;
      tone?: Tone;
    }
  | {
      type: "practice";
      title?: string;
      items: PracticeItem[];
    };

export interface LearningModule {
  id: string;
  title: string;
  summary: string;
  brief?: string;
  presets: LearningPreset[];
  sections: LearningSection[];
}
