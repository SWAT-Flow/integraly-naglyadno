import { Button } from "./ui";
import { decodeEscapedUnicode } from "../utils/decodeEscapedUnicode";

export interface TemplateInsert {
  text: string;
  cursorOffset: number;
  wrapSelection?: boolean;
}

interface TemplateKeyboardProps {
  onInsert: (template: TemplateInsert) => void;
}

function unaryTemplate(name: string): TemplateInsert {
  return { text: `${name}()`, cursorOffset: -1, wrapSelection: true };
}

function binaryTemplate(name: string): TemplateInsert {
  return { text: `${name}(,)`, cursorOffset: -2 };
}

const GROUPS: Array<{ title: string; items: Array<{ label: string; template: TemplateInsert }> }> = [
  {
    title: "\u0411\u0430\u0437\u043e\u0432\u044b\u0435",
    items: [
      { label: "x", template: { text: "x", cursorOffset: 0 } },
      { label: "\u03c0", template: { text: "pi", cursorOffset: 0 } },
      { label: "e", template: { text: "e", cursorOffset: 0 } },
      { label: "^", template: { text: "^", cursorOffset: 0 } },
      { label: "\u221a", template: unaryTemplate("sqrt") },
      { label: "|x|", template: unaryTemplate("abs") },
      { label: "ln", template: unaryTemplate("ln") },
      { label: "lg", template: unaryTemplate("log") },
      { label: "log\u2090", template: binaryTemplate("log") },
      { label: "exp", template: unaryTemplate("exp") },
    ],
  },
  {
    title: "\u0422\u0440\u0438\u0433\u043e\u043d\u043e\u043c\u0435\u0442\u0440\u0438\u0447\u0435\u0441\u043a\u0438\u0435 \u0444\u0443\u043d\u043a\u0446\u0438\u0438",
    items: [
      { label: "sin", template: unaryTemplate("sin") },
      { label: "cos", template: unaryTemplate("cos") },
      { label: "tan", template: unaryTemplate("tan") },
      { label: "csc", template: unaryTemplate("csc") },
      { label: "sec", template: unaryTemplate("sec") },
      { label: "cot", template: unaryTemplate("cot") },
    ],
  },
  {
    title: "\u041e\u0431\u0440\u0430\u0442\u043d\u044b\u0435 \u0442\u0440\u0438\u0433\u043e\u043d\u043e\u043c\u0435\u0442\u0440\u0438\u0447\u0435\u0441\u043a\u0438\u0435 \u0444\u0443\u043d\u043a\u0446\u0438\u0438",
    items: [
      { label: "sin\u207b\u00b9", template: unaryTemplate("asin") },
      { label: "cos\u207b\u00b9", template: unaryTemplate("acos") },
      { label: "tan\u207b\u00b9", template: unaryTemplate("atan") },
      { label: "csc\u207b\u00b9", template: unaryTemplate("acsc") },
      { label: "sec\u207b\u00b9", template: unaryTemplate("asec") },
      { label: "cot\u207b\u00b9", template: unaryTemplate("acot") },
    ],
  },
  {
    title: "\u0413\u0438\u043f\u0435\u0440\u0431\u043e\u043b\u0438\u0447\u0435\u0441\u043a\u0438\u0435 \u0444\u0443\u043d\u043a\u0446\u0438\u0438",
    items: [
      { label: "sinh", template: unaryTemplate("sinh") },
      { label: "cosh", template: unaryTemplate("cosh") },
      { label: "tanh", template: unaryTemplate("tanh") },
      { label: "sinh\u207b\u00b9", template: unaryTemplate("asinh") },
      { label: "cosh\u207b\u00b9", template: unaryTemplate("acosh") },
      { label: "tanh\u207b\u00b9", template: unaryTemplate("atanh") },
    ],
  },
];

export function TemplateKeyboard({ onInsert }: TemplateKeyboardProps) {
  return (
    <section className="card keyboard-card">
      <div className="card-body keyboard-card-body">
        <div className="keyboard-groups">
          {GROUPS.map((group) => (
            <div key={group.title} className="keyboard-group">
              <div className="keyboard-title">{decodeEscapedUnicode(group.title)}</div>
              <div className="keyboard-buttons">
                {group.items.map((item) => (
                  <Button
                    key={`${group.title}-${item.label}`}
                    className="keyboard-button"
                    onClick={() => onInsert(item.template)}
                    onMouseDown={(event) => {
                      event.preventDefault();
                    }}
                  >
                    {item.label}
                  </Button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
