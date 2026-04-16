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

const GROUPS: Array<{ title: string; items: Array<{ label: string; template: TemplateInsert }> }> = [
  {
    title: "\u0411\u0430\u0437\u043e\u0432\u044b\u0435",
    items: [
      { label: "x", template: { text: "x", cursorOffset: 0 } },
      { label: "\u03c0", template: { text: "pi", cursorOffset: 0 } },
      { label: "e", template: { text: "e", cursorOffset: 0 } },
      { label: "^", template: { text: "^", cursorOffset: 0 } },
      { label: "\u221a(.)", template: { text: "sqrt()", cursorOffset: -1, wrapSelection: true } },
      { label: "|.|", template: { text: "abs()", cursorOffset: -1, wrapSelection: true } },
      { label: "ln(.)", template: { text: "ln()", cursorOffset: -1, wrapSelection: true } },
      { label: "log(.,.)", template: { text: "log(, )", cursorOffset: -3 } },
      { label: "exp(.)", template: { text: "exp()", cursorOffset: -1, wrapSelection: true } },
    ],
  },
  {
    title: "\u0422\u0440\u0438\u0433\u043e\u043d\u043e\u043c\u0435\u0442\u0440\u0438\u0447\u0435\u0441\u043a\u0438\u0435 \u0444\u0443\u043d\u043a\u0446\u0438\u0438",
    items: [
      { label: "sin(.)", template: { text: "sin()", cursorOffset: -1, wrapSelection: true } },
      { label: "cos(.)", template: { text: "cos()", cursorOffset: -1, wrapSelection: true } },
      { label: "tan(.)", template: { text: "tan()", cursorOffset: -1, wrapSelection: true } },
      { label: "csc(.)", template: { text: "csc()", cursorOffset: -1, wrapSelection: true } },
      { label: "sec(.)", template: { text: "sec()", cursorOffset: -1, wrapSelection: true } },
      { label: "cot(.)", template: { text: "cot()", cursorOffset: -1, wrapSelection: true } },
    ],
  },
  {
    title: "\u041e\u0431\u0440\u0430\u0442\u043d\u044b\u0435 \u0442\u0440\u0438\u0433\u043e\u043d\u043e\u043c\u0435\u0442\u0440\u0438\u0447\u0435\u0441\u043a\u0438\u0435 \u0444\u0443\u043d\u043a\u0446\u0438\u0438",
    items: [
      { label: "sin\u207b\u00b9(.)", template: { text: "asin()", cursorOffset: -1, wrapSelection: true } },
      { label: "cos\u207b\u00b9(.)", template: { text: "acos()", cursorOffset: -1, wrapSelection: true } },
      { label: "tan\u207b\u00b9(.)", template: { text: "atan()", cursorOffset: -1, wrapSelection: true } },
      { label: "csc\u207b\u00b9(.)", template: { text: "acsc()", cursorOffset: -1, wrapSelection: true } },
      { label: "sec\u207b\u00b9(.)", template: { text: "asec()", cursorOffset: -1, wrapSelection: true } },
      { label: "cot\u207b\u00b9(.)", template: { text: "acot()", cursorOffset: -1, wrapSelection: true } },
    ],
  },
  {
    title: "\u0413\u0438\u043f\u0435\u0440\u0431\u043e\u043b\u0438\u0447\u0435\u0441\u043a\u0438\u0435 \u0444\u0443\u043d\u043a\u0446\u0438\u0438",
    items: [
      { label: "sinh(.)", template: { text: "sinh()", cursorOffset: -1, wrapSelection: true } },
      { label: "cosh(.)", template: { text: "cosh()", cursorOffset: -1, wrapSelection: true } },
      { label: "tanh(.)", template: { text: "tanh()", cursorOffset: -1, wrapSelection: true } },
      { label: "sinh\u207b\u00b9(.)", template: { text: "asinh()", cursorOffset: -1, wrapSelection: true } },
      { label: "cosh\u207b\u00b9(.)", template: { text: "acosh()", cursorOffset: -1, wrapSelection: true } },
      { label: "tanh\u207b\u00b9(.)", template: { text: "atanh()", cursorOffset: -1, wrapSelection: true } },
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
